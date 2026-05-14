import requests
import datetime
import os
import base64
from urllib.parse import unquote

def send_report(user_id, m_val, i_val=None, report_type='navigator'):
    """
    Отправка отчета в Telegram
    
    Args:
        user_id: ID пользователя VK
        m_val: Имя маршрута
        i_val: Опционально - информация о пользователе (закодированная строка: id,имя_фамилия,город)
        report_type: 'navigator' или 'editor'
    """
    token = os.getenv("TELEGRAM_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        return

    offset = datetime.timezone(datetime.timedelta(hours=3))
    now_moscow = datetime.datetime.now(offset).strftime("%d.%m.%Y %H:%M:%S")

    user_info_text = ""
    if i_val:
        try:
            decoded_bytes = base64.b64decode(i_val)
            decoded_str = decoded_bytes.decode('utf-8')
            url_decoded = unquote(decoded_str)
            parts = url_decoded.split(',')
            vk_id = parts[0] if len(parts) > 0 else '?'
            user_name = parts[1] if len(parts) > 1 else '?'
            city = parts[2] if len(parts) > 2 else '?'
            user_info_text = f"ID: {vk_id}, Имя: {user_name}, Город: {city}"
        except Exception as e:
            user_info_text = "ошибка декодирования"

    if report_type == 'editor':
        message = (
            f"📊 *Загрузка маршрута в редакторе*\n"
            f"🕒 `{now_moscow}`\n"
            f"🆔 ID: `{user_id}`\n"
            f"Ⓜ️ M: `{user_id}-{m_val}`"
        )
    else:
        message = (
            f"📊 *Запуск навигатора*\n"
            f"🕒 `{now_moscow}`\n"
            f"🆔 Маршрут: `{user_id}`-`{m_val}`\n"
            f"👤 Пользователь: {user_info_text}"
        )

    try:
        requests.get(
            f"https://api.telegram.org/bot{token}/sendMessage",
            params={
                "chat_id": chat_id, 
                "text": message,
                "parse_mode": "Markdown"
            },
            timeout=2 
        )
    except Exception:
        pass
