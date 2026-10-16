# n8n Self-Hosted Automation & Deployment Tools

[![PowerShell](https://img.shields.io/badge/PowerShell-5.1%20%7C%207%2B-blue.svg)](https://microsoft.com/powershell)
[![n8n](https://img.shields.io/badge/n8n-Self--Hosted%20Docker-EA4B71.svg)](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-docker)
[![Docker Desktop](https://img.shields.io/badge/Docker%20Desktop-WinGet-2496ED.svg)](https://www.docker.com/products/docker-desktop/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Automation tools and infrastructure scripts for deploying, updating, and managing self-hosted **n8n** environments on Windows.

---

## 📦 Featured Tools

### [**deploy-n8n-on-windows-docker-desktop**](deploy-n8n-on-windows-docker-desktop/README.md)
* **Script:** [`deploy-n8n-on-windows-docker-desktop/deploy-n8n-on-windows-docker-desktop.ps1`](deploy-n8n-on-windows-docker-desktop/deploy-n8n-on-windows-docker-desktop.ps1)
* **Author:** Roman Pindela (`roman.pindela@gmail.com`)
* **Version:** 1.2.0
* **Description:** Provisions and updates the **WSL2** environment (`wsl.exe --update`), downloads and installs **Docker Desktop** via **WinGet** to a custom SSD directory (`c:\DANE\rpindela\SSD\Docker\`), and deploys a self-hosted **n8n** container (`n8nio/n8n`) with persistent storage (`n8n_data`), timezone settings, optional PostgreSQL backend, multi-stage `Write-Progress` bars, workflow file upload/import (`-ImportWorkflowsPath`), UAC auto-elevation, and structured logging to `C:\Logs`.

```powershell
# Unblock and view help
Unblock-File -Path .\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1
.\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1 -h

# Execute full deployment to c:\DANE\rpindela\SSD\Docker\
.\deploy-n8n-on-windows-docker-desktop\deploy-n8n-on-windows-docker-desktop.ps1 -Deploy -OpenBrowser
```

---

## 👨‍💻 Author & Contact

* **Author:** Roman Pindela
* **Email:** [roman.pindela@gmail.com](mailto:roman.pindela@gmail.com)
* **GitHub:** [https://github.com/romanpindela](https://github.com/romanpindela)
* **License:** MIT
