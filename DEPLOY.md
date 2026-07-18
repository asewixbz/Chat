# Руководство по развертыванию приложения на VPS

В этом руководстве описан процесс переноса и запуска вашего чат-приложения на собственном виртуальном сервере (VPS) под управлением Ubuntu/Debian.

---

## 📋 Требования к серверу
* **ОС:** Ubuntu 22.04 LTS (или любая современная Linux-система).
* **Характеристики:** Минимум 1 vCPU, 1 ГБ RAM.
* **ПО:** Установленный Node.js (v18 или новее) и менеджер пакетов npm.

---

## 🛠️ Шаг 1. Подготовка сервера

### 1. Обновление пакетов системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Node.js (v20 LTS) и npm
Рекомендуется использовать официальный репозиторий NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Проверьте установку:
```bash
node -v
npm -v
```

### 3. Установка Git и PM2 (менеджера процессов)
```bash
sudo apt install git -y
sudo npm install -g pm2
```

---

## 📁 Шаг 2. Загрузка и подготовка проекта

### 1. Клонирование репозитория
Склонируйте ваш репозиторий на сервер (или загрузите файлы через SFTP в папку `/var/www/kie-chat`):
```bash
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> /var/www/kie-chat
cd /var/www/kie-chat
```

### 2. Настройка переменных окружения
Создайте рабочий файл `.env` из шаблона:
```bash
cp .env.example .env
```
Откройте файл для редактирования (например, через `nano`):
```bash
nano .env
```
Задайте следующие настройки:
```env
# Режим запуска (production)
NODE_ENV=production

# Порт, на котором будет крутиться сервер внутри VPS
PORT=3000

# Необязательный дефолтный ключ Kie API для бэкенда (можно оставить пустым, если пользователи вводят свой)
KIE_API_KEY=""

# (Опционально) Домен или URL вашего сайта
APP_URL="https://your-domain.com"
```
*Нажмите `Ctrl+O`, затем `Enter` для сохранения, и `Ctrl+X` для выхода из nano.*

---

## 🏗️ Шаг 3. Установка зависимостей и сборка

Проект использует полноценный full-stack стек. Скрипт сборки компилирует фронтенд через **Vite**, а серверную часть упаковывает через **esbuild** в один оптимизированный файл `dist/server.cjs`.

### 1. Установка всех необходимых библиотек:
```bash
npm install
```

### 2. Сборка приложения:
```bash
npm run build
```
После успешного выполнения сборки в папке `dist/` появятся:
* Статические файлы интерфейса (HTML, CSS, JS).
* Готовый к запуску сервер бэкенда — `dist/server.cjs`.

---

## 🚀 Шаг 4. Настройка фонового запуска через PM2

PM2 гарантирует, что ваше приложение будет работать в фоновом режиме, автоматически перезагружаться в случае сбоев и запускаться вместе с перезагрузкой сервера.

### 1. Запуск приложения в PM2:
```bash
pm2 start dist/server.cjs --name "kie-chat" --env PORT=3000
```

### 2. Настройка автозапуска при перезагрузке VPS:
```bash
pm2 startup
```
*Команда выведет инструкцию — скопируйте предоставленную строку `sudo env PATH=...` и выполните её в терминале.*

Сохраните текущий список процессов:
```bash
pm2 save
```

### Полезные команды PM2:
* Посмотреть логи: `pm2 logs kie-chat`
* Статус процессов: `pm2 status`
* Перезапуск: `pm2 restart kie-chat`
* Остановить: `pm2 stop kie-chat`

---

## 🛡️ Шаг 5. Настройка Nginx и SSL (HTTPS)

Для того чтобы приложение открывалось по вашему домену и поддерживало защищенный протокол HTTPS, настроим веб-сервер Nginx в качестве Reverse Proxy.

### 1. Установка Nginx:
```bash
sudo apt install nginx -y
```

### 2. Создание файла конфигурации для вашего сайта:
```bash
sudo nano /etc/nginx/sites-available/kie-chat
```

Вставьте следующий шаблон конфигурации (замените `your-domain.com` на ваш реальный домен или IP):
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Настройки для корректного стриминга ответов (SSE)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        chunked_transfer_encoding on;
    }
}
```

### 3. Активация конфигурации и перезапуск Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/kie-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Получение бесплатного SSL-сертификата Let's Encrypt через Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
*Следуйте инструкциям на экране (Certbot автоматически настроит перенаправление со стандартного HTTP на безопасный HTTPS).*

---

🎉 **Готово!** Теперь ваше приложение доступно по вашему домену с автоматическим фоновым запуском, поддержкой стриминга в реальном времени и безопасным HTTPS соединением.
