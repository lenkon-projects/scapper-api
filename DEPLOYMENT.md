# Deployment Guide

Инструкция по развёртыванию WordPress Parser API на production сервер.

## Параметры развёртывания

- **Домен**: scrapper.liorizhakidrums.com
- **Сервер**: 72.62.43.253 (Ubuntu)
- **SSH User**: root
- **Email для SSL**: lenkon1@gmail.com
- **Deployment**: GitHub Container Registry + docker-compose

## Шаг 1: Настройка DNS

1. Добавьте A record в настройках вашего DNS провайдера:
   ```
   Type: A
   Name: scrapper (или @scrapper)
   Value: 72.62.43.253
   TTL: 3600
   ```

2. Дождитесь DNS propagation (обычно 5-30 минут, максимум 24 часа)

3. Проверьте DNS:
   ```bash
   nslookup scrapper.liorizhakidrums.com
   # или
   dig scrapper.liorizhakidrums.com
   ```

## Шаг 2: Настройка сервера

1. Подключитесь к серверу по SSH:
   ```bash
   ssh root@72.62.43.253
   ```

2. Скопируйте скрипт server-setup.sh на сервер:
   ```bash
   # На вашей машине
   scp scripts/server-setup.sh root@72.62.43.253:~/
   ```

3. На сервере запустите скрипт:
   ```bash
   sudo bash ~/server-setup.sh
   ```

   Скрипт установит:
   - Docker и Docker Compose
   - Nginx
   - Certbot (для Let's Encrypt)
   - UFW firewall
   - Fail2ban

4. Скопируйте nginx конфигурацию:
   ```bash
   # На вашей машине
   scp nginx/scrapper.liorizhakidrums.com.conf root@72.62.43.253:/etc/nginx/sites-available/
   ```

5. На сервере создайте symlink:
   ```bash
   sudo ln -s /etc/nginx/sites-available/scrapper.liorizhakidrums.com.conf /etc/nginx/sites-enabled/
   ```

6. Проверьте nginx конфигурацию:
   ```bash
   sudo nginx -t
   ```

7. Перезапустите nginx:
   ```bash
   sudo systemctl reload nginx
   ```

8. Скопируйте скрипт ssl-setup.sh и запустите его:
   ```bash
   # На вашей машине
   scp scripts/ssl-setup.sh root@72.62.43.253:~/

   # На сервере
   sudo bash ~/ssl-setup.sh
   ```

   Скрипт получит SSL сертификат от Let's Encrypt и настроит автоматическое продление.

## Шаг 3: Настройка GitHub

### 3.1 Включить GitHub Container Registry

1. Перейдите в Settings → Actions → General
2. В разделе "Workflow permissions" выберите "Read and write permissions"
3. Нажмите Save

### 3.2 Добавить GitHub Secrets

Перейдите в Settings → Secrets and variables → Actions и добавьте следующие secrets:

**Обязательные secrets:**

```
SERVER_HOST = 72.62.43.253
SERVER_USER = root
SSH_PRIVATE_KEY = <содержимое вашего приватного SSH ключа>
```

Для получения SSH ключа:
```bash
# Если у вас уже есть ключ
cat ~/.ssh/id_rsa

# Если нет - создайте новый
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
cat ~/.ssh/id_rsa

# И добавьте публичный ключ на сервер
ssh-copy-id root@72.62.43.253
```

**API Configuration:**

```
API_KEY = <сгенерируйте безопасный UUID>
```

Для генерации API ключа:
```bash
# На Mac/Linux
uuidgen

# Или онлайн
# https://www.uuidgenerator.net/
```

**WordPress credentials:**

```
WP_LOGIN_URL = https://ozentelaviv.com/wp-login.php
WP_USERNAME = <ваш wordpress username>
WP_PASSWORD = <ваш wordpress password>
TARGET_URL = https://ozentelaviv.com/wp-admin/
```

## Шаг 4: Развёртывание

1. Закоммитьте все изменения:
   ```bash
   git add .
   git commit -m "Add Docker and deployment configuration"
   git push origin main
   ```

2. GitHub Actions автоматически запустится и:
   - Соберёт Docker образ
   - Загрузит его в GitHub Container Registry
   - Развернёт на сервер

3. Следите за процессом в разделе "Actions" на GitHub

4. Проверьте развёртывание:
   ```bash
   curl https://scrapper.liorizhakidrums.com/api/health
   ```

   Ожидаемый ответ:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "uptime": 123.456
   }
   ```

## Шаг 5: Проверка работы

1. **Health check:**
   ```bash
   curl https://scrapper.liorizhakidrums.com/api/health
   ```

2. **Swagger документация:**
   Откройте в браузере:
   ```
   https://scrapper.liorizhakidrums.com/api-docs
   ```

3. **Проверка SSL сертификата:**
   Откройте в браузере и проверьте замок в адресной строке

4. **Тест parse endpoint:**
   ```bash
   curl -X POST https://scrapper.liorizhakidrums.com/api/parse \
     -H "Content-Type: application/json" \
     -H "X-API-Key: <ваш-api-key>" \
     -d '{}'
   ```

## Управление сервисом на сервере

### Просмотр статуса

```bash
ssh root@72.62.43.253

cd /root/wordpress-parser

# Статус контейнеров
docker compose ps

# Логи в реальном времени
docker compose logs -f

# Последние 100 строк логов
docker compose logs --tail=100
```

### Перезапуск сервиса

```bash
cd /root/wordpress-parser

# Перезапуск
docker compose restart

# Полная пересборка
docker compose down
docker compose pull
docker compose up -d
```

### Проверка использования ресурсов

```bash
# Docker статистика
docker stats

# Disk usage
du -sh /root/wordpress-parser/output /root/wordpress-parser/logs

# Очистка старых логов
find /root/wordpress-parser/logs -name "*.log" -mtime +30 -delete
```

### Проверка SSL сертификата

```bash
sudo certbot certificates

# Тест продления
sudo certbot renew --dry-run
```

## Troubleshooting

### Container не стартует

```bash
# Проверьте логи
docker compose logs

# Проверьте статус
docker compose ps

# Пересоздайте контейнеры
docker compose down
docker compose up -d
```

### Health check fails

```bash
# Проверьте доступность локально
curl http://localhost:3000/api/health

# Проверьте логи
docker compose logs api

# Зайдите в контейнер
docker compose exec api sh
```

### Puppeteer crashes

Увеличьте memory limit в docker-compose.yml:

```yaml
deploy:
  resources:
    limits:
      memory: 4G  # Вместо 2G
```

### SSL issues

```bash
# Проверьте сертификат
sudo certbot certificates

# Попробуйте обновить
sudo certbot renew

# Если проблемы - пересоздайте
sudo certbot delete --cert-name scrapper.liorizhakidrums.com
sudo bash ~/ssl-setup.sh
```

### Nginx errors

```bash
# Проверьте конфигурацию
sudo nginx -t

# Проверьте логи
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/scrapper.liorizhakidrums.com.error.log

# Перезапустите nginx
sudo systemctl reload nginx
```

### Rate limiting слишком строгий

Отредактируйте `/etc/nginx/sites-available/scrapper.liorizhakidrums.com`:

```nginx
# Измените rate
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;  # Было 10r/m
```

Затем:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Обслуживание

### Ежедневно
- Проверяйте `docker compose ps` и `docker compose logs --tail=50`
- Убедитесь, что health check работает

### Еженедельно
- Проверяйте disk usage (output/ и logs/)
- Просматривайте nginx access logs
- Проверяйте SSL validity: `sudo certbot certificates`

### Ежемесячно
- Обновляйте систему: `sudo apt update && sudo apt upgrade -y`
- Пересобирайте образы (push в main запустит GitHub Actions)
- Проверяйте использование API

### При необходимости
- Очищайте старые output файлы
- Ротируйте API keys
- Обновляйте зависимости: `npm audit`

## Полезные команды

```bash
# Мониторинг в реальном времени
watch -n 5 'docker compose ps && docker stats --no-stream'

# Backup данных
tar -czf backup-$(date +%Y%m%d).tar.gz -C /root/wordpress-parser output logs .env

# Восстановление из backup
tar -xzf backup-20240101.tar.gz -C /root/wordpress-parser

# Просмотр открытых портов
sudo netstat -tlnp | grep -E '(3000|80|443)'

# Проверка firewall
sudo ufw status verbose
```

## Архитектура

```
Internet
   ↓
Nginx (443) → SSL/TLS
   ↓
Rate Limiting
   ↓
Nginx Reverse Proxy
   ↓
localhost:3000
   ↓
Docker Container (wordpress-parser-api)
   ↓
Node.js Express API + Puppeteer
```

## Безопасность

- ✅ API bind только на localhost (127.0.0.1:3000)
- ✅ Весь внешний трафик через Nginx с SSL
- ✅ Rate limiting на Nginx уровне
- ✅ API Key authentication
- ✅ UFW firewall (только 22, 80, 443)
- ✅ Fail2ban для SSH protection
- ✅ Security headers (HSTS, CSP, etc.)
- ✅ Non-root пользователь в контейнере
- ✅ Resource limits на контейнер

## Поддержка

Если возникли проблемы:

1. Проверьте логи: `docker compose logs`
2. Проверьте GitHub Actions logs
3. Проверьте nginx logs: `/var/log/nginx/`
4. Обратитесь к разделу Troubleshooting выше
