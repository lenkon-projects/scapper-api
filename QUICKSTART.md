# Quick Start Guide

Быстрая инструкция по развёртыванию. Для подробностей см. [DEPLOYMENT.md](DEPLOYMENT.md)

## Предварительные требования

- [ ] DNS: A record `scrapper.liorizhakidrums.com` → `72.62.43.253`
- [ ] SSH доступ: `ssh root@72.62.43.253`
- [ ] GitHub репозиторий настроен

## Шаг 1: Настройка сервера (5-10 минут)

```bash
# 1. Подключитесь к серверу
ssh root@72.62.43.253

# 2. Скопируйте и запустите скрипт установки (с вашей машины)
scp scripts/server-setup.sh root@72.62.43.253:~/
ssh root@72.62.43.253 'sudo bash ~/server-setup.sh'

# 3. Скопируйте nginx конфигурацию
scp nginx/scrapper.liorizhakidrums.com.conf root@72.62.43.253:/etc/nginx/sites-available/

# 4. Настройте nginx (на сервере)
ssh root@72.62.43.253
sudo ln -s /etc/nginx/sites-available/scrapper.liorizhakidrums.com.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 5. Получите SSL сертификат
# С вашей машины:
scp scripts/ssl-setup.sh root@72.62.43.253:~/
# На сервере:
sudo bash ~/ssl-setup.sh
```

## Шаг 2: Настройка GitHub (5 минут)

### 2.1 Workflow permissions
- Перейдите в `Settings` → `Actions` → `General`
- Выберите `Read and write permissions`
- Сохраните

### 2.2 Добавьте Secrets
Перейдите в `Settings` → `Secrets and variables` → `Actions`

**Серверные secrets:**
```
SERVER_HOST = 72.62.43.253
SERVER_USER = root
SSH_PRIVATE_KEY = <cat ~/.ssh/id_rsa>
```

**API Configuration:**
```
API_KEY = <uuidgen>
```

**WordPress credentials:**
```
WP_LOGIN_URL = https://ozentelaviv.com/wp-login.php
WP_USERNAME = <ваш username>
WP_PASSWORD = <ваш password>
TARGET_URL = https://ozentelaviv.com/wp-admin/
```

## Шаг 3: Развёртывание (автоматически)

```bash
# Закоммитьте изменения
git add .
git commit -m "Add Docker and deployment configuration"
git push origin main

# GitHub Actions автоматически развернёт приложение
# Следите за процессом в разделе Actions
```

## Шаг 4: Проверка

```bash
# Health check
curl https://scrapper.liorizhakidrums.com/api/health

# Swagger docs
open https://scrapper.liorizhakidrums.com/api-docs
```

## Готово!

Ваш API теперь работает на:
- **URL**: https://scrapper.liorizhakidrums.com
- **API Docs**: https://scrapper.liorizhakidrums.com/api-docs
- **Health**: https://scrapper.liorizhakidrums.com/api/health

## Полезные команды

```bash
# Посмотреть логи
ssh root@72.62.43.253 'cd /root/wordpress-parser && docker compose logs -f'

# Статус
ssh root@72.62.43.253 'cd /root/wordpress-parser && docker compose ps'

# Перезапуск
ssh root@72.62.43.253 'cd /root/wordpress-parser && docker compose restart'
```

## Следующие шаги

- Протестируйте API endpoints
- Настройте мониторинг (опционально)
- Настройте бэкапы (опционально)
- Обновите .env переменные при необходимости

Для troubleshooting и подробной информации см. [DEPLOYMENT.md](DEPLOYMENT.md)
