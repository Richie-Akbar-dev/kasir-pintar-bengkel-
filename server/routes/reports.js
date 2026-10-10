import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import {
  asyncHandler,
  intNum,
  num,
  ymd,
  startOfToday,
  startOfMonth,
  transactionProfit,
  PAYMENT_LABELS,
} from '../util.js';

const router = Router();

const isOwner = (req) => req.user?.role === 'owner';

function filtered(from, to) {
  const start = from ? new Date(`${from}T00:00:00.000`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  return db.find('transactions', (t) => {
    if (t.status !== 'paid') return false;
    const time = new Date(t.date).getTime();
    if (start && time < start.getTime()) return false;
    if (end && time > end.getTime()) return false;
    return true;
  });
}

function filteredExpenses(from, to) {
  const start = from ? new Date(`${from}T00:00:00.000`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  return db.find('expenses', (e) => {
    const time = new Date(e.date).getTime();
    if (start && time < start.getTime()) return false;
    if (end && time > end.getTime()) return false;
    return true;
  });
}

/* ====================== RINGKASAN DASHBOARD ====================== */

router.get(
  '/summary',
  requireAuth,
  asyncHandler((req, res) => {
    const owner = isOwner(req);
    const today = startOfToday();
    const monthStart = startOfMonth();

    const paid = db.find('transactions', (t) => t.status === 'paid');
    const todayTrx = paid.filter((t) => new Date(t.date) >= today);
    const monthTrx = paid.filter((t) => new Date(t.date) >= monthStart);

    const sum = (rows) => rows.reduce((a, t) => a + num(t.total), 0);
    const profit = (rows) => rows.reduce((a, t) => a + transactionProfit(t), 0);

    const monthExpenses = db
      .find('expenses', (e) => new Date(e.date) >= monthStart)
      .reduce((a, e) => a + num(e.amount), 0);

    const lowStock = db
      .all('products')
      .filter((p) => num(p.stock) <= num(p.minStock) && p.active !== false);

    const receivables = paid.filter((t) => t.paymentMethod === 'credit' && !t.creditSettled);

    res.json({
      data: {
        today: {
          omzet: sum(todayTrx),
          transactions: todayTrx.length,
          profit: owner ? profit(todayTrx) : null,
        },
        month: {
          omzet: sum(monthTrx),
          transactions: monthTrx.length,
          profit: owner ? profit(monthTrx) : null,
          expenses: monthExpenses,
          netProfit: owner ? profit(monthTrx) - monthExpenses : null,
        },
        workOrders: {
          active: db.count('work_orders', (w) => w.status === 'menunggu' || w.status === 'dikerjakan'),
          waiting: db.count('work_orders', (w) => w.status === 'menunggu'),
          inProgress: db.count('work_orders', (w) => w.status === 'dikerjakan'),
          ready: db.count('work_orders', (w) => w.status === 'selesai'),
        },
        inventory: {
          totalProducts: db.count('products'),
          lowStock: lowStock.length,
          stockValue: owner
            ? db.all('products').reduce((a, p) => a + num(p.costPrice) * num(p.stock), 0)
            : null,
        },
        receivables: {
          count: receivables.length,
          total: receivables.reduce((a, t) => a + num(t.total), 0),
        },
        recentTransactions: paid
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 8)
          .map((t) => ({
            id: t.id,
            code: t.code,
            date: t.date,
            customerName: t.customerName,
            total: t.total,
            paymentMethod: t.paymentMethod,
            itemCount: (t.items || []).reduce((a, i) => a + num(i.qty), 0),
          })),
        lowStockItems: lowStock
          .slice(0, 8)
          .map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            stock: num(p.stock),
            minStock: num(p.minStock),
            unit: p.unit,
          })),
      },
    });
  })
);

/* ====================== GRAFIK OMZET HARIAN ====================== */

router.get(
  '/revenue-series',
  requireAuth,
  asyncHandler((req, res) => {
    const days = Math.min(365, Math.max(7, intNum(req.query.days, 30)));
    const owner = isOwner(req);
    const paid = db.find('transactions', (t) => t.status === 'paid');

    const buckets = [];
    const index = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = ymd(d);
      const bucket = { date: key, omzet: 0, profit: 0, transactions: 0 };
      index.set(key, bucket);
      buckets.push(bucket);
    }

    for (const t of paid) {
      const key = ymd(t.date);
      const bucket = index.get(key);
      if (!bucket) continue;
      bucket.omzet += num(t.total);
      bucket.profit += transactionProfit(t);
      bucket.transactions += 1;
    }

    res.json({
      data: buckets.map((b) => ({
        date: b.date,
        omzet: b.omzet,
        profit: owner ? b.profit : null,
        transactions: b.transactions,
      })),
    });
  })
);

/* ========================== ITEM TERLARIS ========================== */

router.get(
  '/top-items',
  requireAuth,
  asyncHandler((req, res) => {
    const { from, to, type = 'all' } = req.query;
    const owner = isOwner(req);
    const rows = filtered(from, to);

    const map = new Map();
    for (const t of rows) {
      for (const it of t.items || []) {
        if (type !== 'all' && it.type !== type) continue;
        const key = `${it.type}:${it.refId}`;
        const cur =
          map.get(key) ||
          {
            type: it.type,
            refId: it.refId,
            code: it.code,
            name: it.name,
            qty: 0,
            revenue: 0,
            profit: 0,
          };
        cur.qty += num(it.qty);
        cur.revenue += num(it.price) * num(it.qty) - num(it.discount);
        cur.profit += (num(it.price) - num(it.costPrice)) * num(it.qty) - num(it.discount);
        map.set(key, cur);
      }
    }

    const data = [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15)
      .map((r) => ({
        ...r,
        profit: owner ? r.profit : null,
      }));

    res.json({ data });
  })
);

/* ======================== KINERJA MEKANIK ======================== */

router.get(
  '/mechanics',
  requireAuth,
  asyncHandler((req, res) => {
    const { from, to } = req.query;
    const rows = filtered(from, to);
    const mechanics = db.all('mechanics');

    const map = new Map();
    const ensure = (id, name, share) => {
      if (!map.has(id))
        map.set(id, {
          mechanicId: id,
          name,
          sharePercent: num(share),
          jobCount: 0,
          revenue: 0,
          commission: 0,
        });
      return map.get(id);
    };

    for (const t of rows) {
      for (const it of t.items || []) {
        if (!it.mechanicId) continue;
        const mech = db.byId('mechanics', it.mechanicId);
        const cur = ensure(it.mechanicId, mech ? mech.name : 'Tanpa nama', mech ? mech.sharePercent : 0);
        cur.jobCount += num(it.qty);
        cur.revenue += num(it.price) * num(it.qty) - num(it.discount);
      }
    }

    const data = [...map.values()]
      .map((r) => ({ ...r, commission: Math.round((r.revenue * r.sharePercent) / 100) }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({ data });
  })
);

/* ====================== METODE PEMBAYARAN ====================== */

router.get(
  '/payments',
  requireAuth,
  asyncHandler((req, res) => {
    const rows = filtered(req.query.from, req.query.to);
    const map = new Map();
    for (const t of rows) {
      const key = t.paymentMethod || 'cash';
      const cur = map.get(key) || { method: key, label: PAYMENT_LABELS[key] || key, count: 0, total: 0 };
      cur.count += 1;
      cur.total += num(t.total);
      map.set(key, cur);
    }
    res.json({ data: [...map.values()].sort((a, b) => b.total - a.total) });
  })
);

/* ====================== OMZET PER KATEGORI ====================== */

router.get(
  '/categories',
  requireAuth,
  asyncHandler((req, res) => {
    const { from, to, type = 'all' } = req.query;
    const rows = filtered(from, to);
    const map = new Map();
    for (const t of rows) {
      for (const it of t.items || []) {
        if (type !== 'all' && it.type !== type) continue;
        const source =
          it.type === 'product' ? db.byId('products', it.refId) : db.byId('services', it.refId);
        const category = source?.category || 'Lainnya';
        const cur = map.get(category) || { category, revenue: 0, qty: 0 };
        cur.revenue += num(it.price) * num(it.qty) - num(it.discount);
        cur.qty += num(it.qty);
        map.set(category, cur);
      }
    }
    res.json({ data: [...map.values()].sort((a, b) => b.revenue - a.revenue) });
  })
);

/* ====================== LABA / RUGI BULANAN ====================== */

router.get(
  '/monthly',
  requireAuth,
  asyncHandler((req, res) => {
    const owner = isOwner(req);
    const months = Math.min(36, Math.max(3, intNum(req.query.months, 12)));
    const paid = db.find('transactions', (t) => t.status === 'paid');
    const expenses = db.all('expenses');

    const buckets = [];
    const index = new Map();
    for (let i = months - 1; i >= 0; i--) {
      const start = startOfMonth(-i);
      const end = startOfMonth(-i + 1);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      const bucket = { month: key, omzet: 0, profit: 0, expenses: 0, transactions: 0, start, end };
      index.set(key, bucket);
      buckets.push(bucket);
    }

    for (const t of paid) {
      const time = new Date(t.date).getTime();
      for (const b of buckets) {
        if (time >= b.start.getTime() && time < b.end.getTime()) {
          b.omzet += num(t.total);
          b.profit += transactionProfit(t);
          b.transactions += 1;
          break;
        }
      }
    }
    for (const e of expenses) {
      const time = new Date(e.date).getTime();
      for (const b of buckets) {
        if (time >= b.start.getTime() && time < b.end.getTime()) {
          b.expenses += num(e.amount);
          break;
        }
      }
    }

    res.json({
      data: buckets.map(({ month, omzet, profit, expenses: exp, transactions }) => ({
        month,
        omzet,
        profit: owner ? profit : null,
        expenses: owner ? exp : null,
        netProfit: owner ? profit - exp : null,
        transactions,
      })),
    });
  })
);

/* ====================== LABA / RUGI RENTANG ====================== */

router.get(
  '/profit-loss',
  requireAuth,
  asyncHandler((req, res) => {
    const owner = isOwner(req);
    const { from, to } = req.query;
    const rows = filtered(from, to);
    const exp = filteredExpenses(from, to);

    const revenue = rows.reduce((a, t) => a + num(t.total), 0);
    const grossProfit = rows.reduce((a, t) => a + transactionProfit(t), 0);
    const totalExpenses = exp.reduce((a, e) => a + num(e.amount), 0);

    // Komisi mekanik (bagi hasil) dari item jasa/sparepart yang dikerjakannya
    let totalCommission = 0;
    for (const t of rows) {
      for (const it of t.items || []) {
        if (!it.mechanicId) continue;
        const mech = db.byId('mechanics', it.mechanicId);
        if (!mech) continue;
        const value = num(it.price) * num(it.qty) - num(it.discount);
        totalCommission += (value * num(mech.sharePercent)) / 100;
      }
    }
    totalCommission = Math.round(totalCommission);

    // Nilai modal barang yang terjual (HPP)
    const cogs = rows.reduce(
      (a, t) =>
        a +
        (t.items || []).reduce(
          (b, it) => b + (it.type === 'product' ? num(it.costPrice) * num(it.qty) : 0),
          0
        ),
      0
    );

    res.json({
      data: {
        from: from || null,
        to: to || null,
        transactions: rows.length,
        revenue,
        cogs: owner ? cogs : null,
        grossProfit: owner ? grossProfit : null,
        commission: owner ? totalCommission : null,
        expenses: owner ? totalExpenses : null,
        netProfit: owner ? grossProfit - totalCommission - totalExpenses : null,
        avgTransaction: rows.length ? Math.round(revenue / rows.length) : 0,
      },
    });
  })
);

export default router;
