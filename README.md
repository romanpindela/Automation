# Automation & Workflow Engineering Toolkit

[![PowerShell](https://img.shields.io/badge/PowerShell-5.1%20%7C%207%2B-blue.svg)](https://microsoft.com/powershell)
[![n8n](https://img.shields.io/badge/n8n-Workflow%20Automation-EA4B71.svg)](https://n8n.io/)
[![Docker](https://img.shields.io/badge/Docker-Self--Hosted-2496ED.svg)](https://www.docker.com/)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-4285F4.svg)](https://developers.google.com/apps-script)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A collection of enterprise-grade workflow automation scripts, self-hosted container deployment tools, and cloud integrations engineered by **Roman Pindela**. This repository spans **n8n Docker infrastructure automation** and **Google Workspace (Google Apps Script)** business process automation.

---

## 🏛️ Repository Structure

```text
Automation/
├── n8n/                                       # Self-hosted n8n infrastructure & workflow tools
│   └── deploy-n8n-on-windows-docker-desktop/                            # Automated WinGet Docker Desktop + n8n deployment
│       ├── assets/                            # Visual verification & screenshots
│       ├── deploy-n8n-on-windows-docker-desktop.ps1                     # Main PowerShell deployment & update script
│       └── README.md                          # Technical documentation for deploy-n8n-on-windows-docker-desktop
├── Google Apps Script/                        # Google Workspace & Cloud workflow automations
│   ├── Market Raport/                         # Automated financial & crypto market reporting
│   ├── Migawka wydarzeń/                      # AI-powered regional & global event digest
│   ├── Rejestr badań okresowych/              # Medical checkup tracking & Calendar reminders
│   └── Rejestr Płatności i przelewów/         # Automated invoice & bank transfer registry
└── README.md                                  # Main repository documentation
```

---

## 🚀 Featured Scripts & Modules

### 1. n8n Self-Hosted Infrastructure (`/n8n`)

#### [**deploy-n8n-on-windows-docker-desktop**](n8n/deploy-n8n-on-windows-docker-desktop/README.md)
* **Script:** [`n8n/deploy-n8n-on-windows-docker-desktop/deploy-n8n-on-windows-docker-desktop.ps1`](n8n/deploy-n8n-on-windows-docker-desktop/deploy-n8n-on-windows-docker-desktop.ps1)
* **Author:** Roman Pindela (`roman.pindela@gmail.com`)
* **Version:** 1.2.0
* **Description:** Enterprise PowerShell automation script that provisions the **WSL2** environment (`wsl.exe --update`), downloads and installs **Docker Desktop** via **WinGet** into a dedicated SSD directory (`c:\DANE\rpindela\SSD\Docker\`), and provisions a self-hosted **n8n** instance in Docker based on the official [n8n Docker installation guide](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker).
  * **WSL2 Environment Provisioning (`wsl.exe --update`):** Automatically verifies/enables Windows Subsystem for Linux & Virtual Machine Platform features, updates the WSL2 kernel via `wsl.exe --update`, and sets WSL 2 as default (`wsl.exe --set-default-version 2`).
  * **Custom-Path Docker Desktop Installation:** Configures Docker Desktop binaries, WSL2 virtual disk (`--wsl-default-data-root`), and Windows container storage inside `c:\DANE\rpindela\SSD\Docker\`.
  * **Official n8n Container Provisioning:** Automatically creates the `n8n_data` persistent volume, pulls `n8nio/n8n`, maps port `5678:5678`, enforces settings file permissions (`N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true`), configures timezone (`GENERIC_TIMEZONE` / `TZ`), and supports both SQLite and PostgreSQL (`-UsePostgres`).
  * **Detailed Progress Bars & File Upload Tracking:** Displays detailed startup parameters and multi-stage `Write-Progress` bars during WinGet download, Docker Engine startup, image layer pulls, and workflow `.json` file transfers (`-ImportWorkflowsPath`).
  * **Post-Install Tool Summary:** Prints a concise reference guide after installation showing exact paths to all installed tools (`docker.exe`, `docker-compose.exe`, `Docker Desktop.exe`, WSL2 storage, `n8n_data` volume, logs) and how to use them.
  * **Standards Compliant:** Interactive help on zero parameters (`-h` / `-Help`), language-independent SID UAC auto-elevation (Polish & English Windows), input sanitization, and structured logging to `C:\Logs\<DateTime>-deploy-n8n-on-windows-docker-desktop-<Computer>-<User>.logs`.
* **Quick Start:**
  ```powershell
  # 1. Unblock the script after downloading from GitHub
  Unblock-File -Path .\n8n\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1

  # 2. Display interactive help & examples
  .\n8n\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1 -h

  # 3. Install Docker Desktop to c:\DANE\rpindela\SSD\Docker\ and deploy n8n
  .\n8n\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -OpenBrowser
  ```

---

### 2. Google Apps Script Automations (`/Google Apps Script`)

* [**Market Raport**](Google%20Apps%20Script/Market%20Raport/README.md) — Tracks real-time prices across cryptocurrencies, equities, forex, commodities, and treasury yields using public APIs, archives rows in Google Sheets, and emails formatted HTML reports.
* [**Migawka wydarzeń**](Google%20Apps%20Script/Migawka%20wydarze%C5%84/README.md) — Automated event and news aggregation system integrating Google Sheets, Google Sites, and Gmail newsletters.
* [**Rejestr badań okresowych**](Google%20Apps%20Script/Rejestr%20bada%C5%84%20okresowych/README.md) — Monitors periodic medical examination dates in Google Sheets and synchronizes reminders with Google Calendar.
* [**Rejestr Płatności i przelewów**](Google%20Apps%20Script/Rejestr%20P%C5%82atno%C5%9Bci%20i%20przelew%C3%B3w/README.md) — Parses incoming payment emails, registers transactions in Google Sheets, and schedules payment deadlines in Google Calendar.

---

## 🛡️ Security & PowerShell Standards

All PowerShell scripts in this repository adhere to strict quality and security standards:
1. **Unblock Downloaded Scripts:**
   ```powershell
   Get-ChildItem -Path . -Filter *.ps1 -Recurse | Unblock-File
   ```
2. **Zero-Parameter Help Menu:** Running any `.ps1` script without parameters or with `-h` / `-Help` displays full usage instructions without making system changes.
3. **Language-Independent UAC Auto-Elevation:** Administrator checks use Windows well-known SID `S-1-5-32-544` (`BuiltInAdministratorsSid`), supporting both Polish (`Administratorzy`) and English (`Administrators`) OS locales.
4. **Centralized Audit Logging:** Execution logs are saved automatically to `C:\Logs\<DateTime>-<ScriptName>-<ComputerName>-<UserName>.logs`.

---

## 👨‍💻 Author & Contact

* **Author:** Roman Pindela
* **Email:** [roman.pindela@gmail.com](mailto:roman.pindela@gmail.com)
* **GitHub:** [https://github.com/romanpindela](https://github.com/romanpindela)
* **License:** MIT
