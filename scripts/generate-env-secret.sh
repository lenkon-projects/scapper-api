#!/bin/bash

# Скрипт для генерации многострочного секрета ENV_VARS из локального .env файла
# Использование: ./scripts/generate-env-secret.sh

set -e

ENV_FILE=".env"
TEMPLATE_FILE=".env.template"

echo "🔧 Генерация многострочного секрета ENV_VARS..."

# Проверяем наличие .env файла
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Файл $ENV_FILE не найден!"
    echo "💡 Создайте его на основе $TEMPLATE_FILE:"
    echo "   cp $TEMPLATE_FILE $ENV_FILE"
    echo "   # Заполните реальными значениями"
    exit 1
fi

# Проверяем, что .env не содержит шаблонных значений
if grep -q "REPLACE_WITH_ACTUAL" "$ENV_FILE"; then
    echo "❌ В файле $ENV_FILE найдены незаполненные шаблонные значения!"
    echo "💡 Замените все REPLACE_WITH_ACTUAL_* на реальные значения"
    echo ""
    echo "Незаполненные значения:"
    grep "REPLACE_WITH_ACTUAL" "$ENV_FILE" || true
    exit 1
fi

# Проверяем критически важные переменные
REQUIRED_VARS=(
    "API_KEY"
    "WP_PASSWORD" 
    "MONDAY_COM_API_KEY"
    "TELEGRAM_BOT_TOKEN"
)

echo "🔍 Проверяем наличие критически важных переменных..."
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" "$ENV_FILE"; then
        MISSING_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo "❌ Отсутствуют критически важные переменные:"
    printf "   - %s\n" "${MISSING_VARS[@]}"
    exit 1
fi

echo "✅ Все критически важные переменные найдены"

# Удаляем комментарии и пустые строки, добавляем GITHUB_REPOSITORY
echo "📝 Подготавливаем контент для секрета..."
SECRET_CONTENT=$(cat "$ENV_FILE" | grep -v '^#' | grep -v '^$' | sort)

echo ""
echo "🎯 Контент для GitHub секрета ENV_VARS:"
echo "=================================================="
echo "$SECRET_CONTENT"
echo "=================================================="
echo ""

# Создаем файл для копирования
SECRET_FILE="env-secret-content.txt"
echo "$SECRET_CONTENT" > "$SECRET_FILE"

echo "💾 Контент сохранен в файл: $SECRET_FILE"
echo ""
echo "📋 Следующие шаги:"
echo "1. Скопируйте контент из файла $SECRET_FILE"
echo "2. Перейдите в GitHub: Settings → Secrets and variables → Actions"
echo "3. Создайте новый секрет с именем: ENV_VARS"
echo "4. Вставьте скопированный контент как значение секрета"
echo "5. Удалите файл $SECRET_FILE (содержит чувствительные данные)"
echo ""
echo "🗑️  Удалить файл $SECRET_FILE сейчас? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    rm -f "$SECRET_FILE"
    echo "✅ Файл $SECRET_FILE удален"
else
    echo "⚠️  Не забудьте удалить файл $SECRET_FILE после использования!"
fi

echo ""
echo "✅ Готово! Многострочный секрет ENV_VARS готов к использованию."