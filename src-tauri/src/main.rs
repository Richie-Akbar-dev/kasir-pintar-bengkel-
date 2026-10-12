// Kasir Pintar Bengkel — pembungkus desktop (Tauri v2 + Node.js sidecar)
//
// Cara kerja program ini:
//   1. Mencari folder sumber daya (berisi node.exe + server + tampilan)
//   2. Menentukan folder data: %APPDATA%\kasir-pintar-bengkel\data
//   3. Menjalankan server aplikasi (node.exe server/index.js) secara tersembunyi
//   4. Membuka JENDELA APLIKASI menuju server lokal tersebut — tanpa browser
//   5. Saat aplikasi ditutup, server ikut dimatikan

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Manager;

/// Status server Node.js yang berjalan di latar belakang.
struct ServerState {
    child: Mutex<Option<Child>>,
}

/// Folder data pengguna: %APPDATA%\kasir-pintar-bengkel\data
/// (dibuat otomatis bila belum ada)
fn app_data_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|e| format!("Variabel APPDATA tidak ditemukan: {e}"))?;
    let dir = PathBuf::from(appdata).join("kasir-pintar-bengkel").join("data");
    fs::create_dir_all(&dir).map_err(|e| format!("Gagal membuat folder data: {e}"))?;
    Ok(dir)
}

/// Mencari port TCP yang masih kosong di 127.0.0.1.
fn find_free_port() -> Result<u16, String> {
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Gagal menyiapkan port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Gagal membaca port: {e}"))?
        .port();
    Ok(port)
}

/// Menunggu server siap (maksimal `timeout`).
fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

/// Mencari folder aplikasi di dalam sumber daya (resources).
/// Mendukung dua kemungkinan susunan hasil pembungkusan Tauri.
fn find_app_dir(resource_dir: &std::path::Path) -> Option<PathBuf> {
    let candidates = [
        resource_dir.join("resources").join("app"),
        resource_dir.join("app"),
        resource_dir.to_path_buf(),
    ];
    candidates
        .into_iter()
        .find(|p| p.join("server").join("index.js").exists())
}

/// Perintah dari tampilan: membuka folder data di Windows Explorer.
#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let dir = app_data_dir()?;
    #[cfg(windows)]
    let mut cmd = Command::new("explorer");
    #[cfg(not(windows))]
    let mut cmd = Command::new("xdg-open");
    cmd.arg(&dir)
        .spawn()
        .map_err(|e| format!("Gagal membuka folder data: {e}"))?;
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![open_data_folder])
        .setup(|app| {
            // ---------- Mode pengembangan: `npm run app` (tauri dev) ----------
            // Server & tampilan dijalankan oleh beforeDevCommand (npm run dev),
            // bukan oleh sidecar. Jendela dibuka setelah server dev siap.
            if let Ok(dev_url) = std::env::var("KASIR_DEV_URL") {
                let parsed = tauri::Url::parse(&dev_url)
                    .map_err(|e| format!("KASIR_DEV_URL tidak valid: {e}"))?;
                let port = parsed.port_or_known_default().unwrap_or(5173);
                if !wait_for_server(port, Duration::from_secs(60)) {
                    return Err(format!(
                        "Server pengembangan di port {port} tidak merespons dalam 60 detik. \
                         Pastikan tidak ada aplikasi lain yang memakai port tersebut."
                    )
                    .into());
                }
                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(parsed))
                    .title("Kasir Pintar Bengkel (dev)")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(1024.0, 700.0)
                    .center()
                    .build()
                    .map_err(|e| format!("Gagal membuka jendela aplikasi: {e}"))?;
                return Ok(());
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Folder sumber daya tidak ditemukan: {e}"))?;

            let app_dir = find_app_dir(&resource_dir).ok_or_else(|| {
                "Folder aplikasi (berisi server) tidak ditemukan di dalam paket aplikasi. \
                 Instalasi mungkin rusak — coba pasang ulang aplikasi."
                    .to_string()
            })?;

            let node = app_dir.join("node.exe");
            let server_js = app_dir.join("server").join("index.js");
            if !node.exists() {
                return Err(format!("node.exe tidak ditemukan di {:?}", node).into());
            }

            let data_dir = app_data_dir()?;
            let port = find_free_port()?;

            let mut cmd = Command::new(&node);
            cmd.arg(&server_js)
                .env("PORT", port.to_string())
                .env("HOST", "127.0.0.1")
                .env("NODE_ENV", "production")
                .env("KASIR_DATA_DIR", &data_dir)
                .current_dir(&app_dir);

            // Di Windows: jangan tampilkan jendela console hitam untuk server
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            let child = cmd
                .spawn()
                .map_err(|e| format!("Gagal menjalankan server aplikasi: {e}"))?;

            if !wait_for_server(port, Duration::from_secs(30)) {
                return Err("Server aplikasi tidak merespons dalam 30 detik. \
                     Coba jalankan ulang aplikasi."
                    .into());
            }

            let url = format!("http://127.0.0.1:{port}");
            let parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(parsed))
                .title("Kasir Pintar Bengkel")
                .inner_size(1280.0, 800.0)
                .min_inner_size(1024.0, 700.0)
                .center()
                .build()
                .map_err(|e| format!("Gagal membuka jendela aplikasi: {e}"))?;

            if let Ok(mut guard) = app.state::<ServerState>().child.lock() {
                *guard = Some(child);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Gagal membangun aplikasi Tauri");

    // Saat aplikasi ditutup: matikan server Node.js yang berjalan di latar belakang.
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state = app_handle.state::<ServerState>();
            // Gunakan match (bukan if-let pada hasil lock) agar `guard` dibuang
            // SEBELUM `state` lepas — menghindari error masa pinjam E0597.
            let mut guard = match state.child.lock() {
                Ok(g) => g,
                Err(poisoned) => poisoned.into_inner(),
            };
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    });
}
