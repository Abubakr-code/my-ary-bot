require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// .env dan ma'lumotlarni olish
const token = process.env.BOT_TOKEN;
const iqAirKey = process.env.IQAIR_TOKEN; // IQAir kaliti ishlatiladi
const adminId = parseInt(process.env.ADMIN_ID); 

const bot = new TelegramBot(token, { polling: true });

// --- STATISTIKA ---
let stats = {
  totalMessages: 0,
  totalLocations: 0,
  totalErrors: 0,
};

// Telegram menyusi
bot.setMyCommands([
  { command: '/start', description: '♻️ Botni ishga tushirish' },
  { command: '/help', description: '📚 Yordam' },
  { command: '/info', description: 'ℹ️ Bot haqida' },
  { command: '/subscribe', description: '🔔 Kunlik obuna (08:00)' },
  { command: '/unsubscribe', description: '🔕 Obunani bekor qilish' },
]);

// Bazani yuklash va saqlash
const DB_FILE = path.join(__dirname, 'users.json');

const loadUsers = () => {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE));
  } catch (e) { console.error(e); }
  return {};
};

const saveUsers = (data) => {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); } 
  catch (e) { console.error(e); }
};

let users = loadUsers();

// --- MATNLAR BAZASI (Siz so'ragan to'liq versiya) ---
const texts = {
  uz: {
    welcome: "👋 Assalomu alaykum! Iltimos, tilni tanlang:",
    lang_set: "🇺🇿 O'zbek tili tanlandi.\n📍 Havoni tekshirish uchun <b>Lokatsiya</b> yuboring.",
    send_loc_request: "📍 Iltimos, <b>Lokatsiya</b> yuboring.",
    about_btn: "ℹ️ Bot haqida",
    help_btn: "📚 Yordam",
    about_text: `
🤖 <b>Air Quality Bot haqida</b>

Bu bot sizning hududingizdagi havo sifatini (AQI) aniqlab beradi. Ma'lumotlar xalqaro monitoring stansiyalaridan olinadi.

🌤 <b>Imkoniyatlar:</b>
• 🌫 Havo ifloslanish darajasi (AQI).
• 🌡 Harorat va namlik.
• 💨 Shamol tezligi.
• 😷 PM2.5 (chang) miqdori.
• 🔔 Har kuni 08:00 da avtomatik ma'lumot (Obuna bo'lsangiz).

👨‍💻 Dasturchi: @MysticBakr
    `,
    help_text: `
📚 <b>Yordam bo'limi</b>

📍 <b>Foydalanish:</b>
Botga shunchaki o'z <b>Lokatsiyangizni</b> yuboring, u darhol havo sifatini tahlil qilib beradi.

⚙️ <b>Buyruqlar:</b>
/start - ♻️ Tilni o'zgartirish.
/subscribe - 🔔 Kunlik obunani yoqish.
/unsubscribe - 🔕 Obunani o'chirish.
/info - ℹ️ Bot haqida to'liq ma'lumot.
/help - 📚 Ushbu yordam oynasi.
    `,
    details: { temp: "Harorat", hum: "Namlik", wind: "Shamol", pm: "Chang (PM2.5)" },
    status: {
      good: "🟢 Havo ajoyib! Maska kerak emas.",
      mod: "🟡 Havo biroz iflos, lekin xavfli emas.",
      bad: "🟠 Havo iflos! Maska taqish tavsiya etiladi.",
      haz: "🔴 Diqqat! Havo juda iflos. Maska taqing!"
    }
  },
  ru: {
    welcome: "👋 Здравствуйте! Пожалуйста, выберите язык:",
    lang_set: "🇷🇺 Русский язык выбран.\n📍 Отправьте <b>Локацию</b>, чтобы проверить воздух.",
    send_loc_request: "📍 Пожалуйста, отправьте <b>Локацию</b>.",
    about_btn: "ℹ️ О боте",
    help_btn: "📚 Помощь",
    about_text: `
🤖 <b>О боте Air Quality</b>

Этот бот определяет индекс качества воздуха (AQI) в вашем районе. Данные берутся с международных станций мониторинга.

🌤 <b>Возможности:</b>
• 🌫 Уровень загрязнения воздуха (AQI).
• 🌡 Температура и влажность.
• 💨 Скорость ветра.
• 😷 Уровень PM2.5 (мелкая пыль).
• 🔔 Ежедневные уведомления в 08:00 (при подписке).

👨‍💻 Разработчик: @MysticBakr
    `,
    help_text: `
📚 <b>Раздел помощи</b>

📍 <b>Использование:</b>
Просто отправьте боту свою <b>Локацию</b>, и он мгновенно проанализирует качество воздуха.

⚙️ <b>Команды:</b>
/start - ♻️ Сменить язык.
/subscribe - 🔔 Включить ежедневную подписку.
/unsubscribe - 🔕 Отключить подписку.
/info - ℹ️ Информация о боте.
/help - 📚 Это меню помощи.
    `,
    details: { temp: "Температура", hum: "Влажность", wind: "Ветер", pm: "Пыль (PM2.5)" },
    status: {
      good: "🟢 Воздух отличный! Маска не нужна.",
      mod: "🟡 Воздух немного загрязнен, но безопасен.",
      bad: "🟠 Воздух загрязнен! Рекомендуется маска.",
      haz: "🔴 Внимание! Воздух очень грязный. Наденьте маску!"
    }
  },
  en: {
    welcome: "👋 Hello! Please choose your language:",
    lang_set: "🇬🇧 English selected.\n📍 Please send <b>Location</b> to check air quality.",
    send_loc_request: "📍 Please send <b>Location</b>.",
    about_btn: "ℹ️ About Bot",
    help_btn: "📚 Help",
    about_text: `
🤖 <b>About Air Quality Bot</b>

This bot determines the Air Quality Index (AQI) in your area using data from international monitoring stations.

🌤 <b>Features:</b>
• 🌫 Air pollution level (AQI).
• 🌡 Temperature and humidity.
• 💨 Wind speed.
• 😷 PM2.5 (dust) levels.
• 🔔 Daily updates at 08:00 (if subscribed).

👨‍💻 Developer: @MysticBakr
    `,
    help_text: `
📚 <b>Help Section</b>

📍 <b>Usage:</b>
Simply send your <b>Location</b> to the bot, and it will analyze the air quality instantly.

⚙️ <b>Commands:</b>
/start - ♻️ Change language.
/subscribe - 🔔 Enable daily subscription.
/unsubscribe - 🔕 Disable subscription.
/info - ℹ️ Full bot info.
/help - 📚 This help menu.
    `,
    details: { temp: "Temperature", hum: "Humidity", wind: "Wind", pm: "PM2.5 (Dust)" },
    status: {
      good: "🟢 Air is good! No mask needed.",
      mod: "🟡 Air is moderate, but safe.",
      bad: "🟠 Air is unhealthy! Mask recommended.",
      haz: "🔴 Warning! Air is hazardous. Wear a mask!"
    }
  }
};

const getMainMenu = (lang) => {
  const t = texts[lang];
  return {
    reply_markup: {
      keyboard: [[{ text: t.about_btn }, { text: t.help_btn }]],
      resize_keyboard: true
    }
  };
};

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!users[chatId]) {
    users[chatId] = { joinedAt: new Date(), lang: 'uz', blocked: false, subscribed: false };
    saveUsers(users);
  }
  
  bot.sendMessage(chatId, texts.uz.welcome, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇺🇿 O\'zbekcha', callback_data: 'uz' }, { text: '🇷🇺 Русский', callback_data: 'ru' }, { text: '🇬🇧 English', callback_data: 'en' }]
      ]
    }
  });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const lang = query.data;

  if (users[chatId]) {
    users[chatId].lang = lang;
    users[chatId].blocked = false;
    saveUsers(users);
  }
  bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
  bot.sendMessage(chatId, texts[lang].lang_set, { parse_mode: 'HTML', ...getMainMenu(lang) });
});

// --- STATISTIKA (ADMIN UCHUN) ---
bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== adminId) {
    return bot.sendMessage(chatId, "🔒 Bu buyruq faqat admin uchun!");
  }

  const allIds = Object.keys(users);
  const totalUsers = allIds.length;
  const subscribedUsers = allIds.filter(id => users[id].subscribed).length;

  const message = `
📊 <b>Bot Statistikasi (IQAir):</b>

🔹 <b>Faoliyat:</b>
📨 Jami xabarlar: ${stats.totalMessages}
📍 Jami lokatsiyalar: ${stats.totalLocations}
⚠️ Jami xatoliklar: ${stats.totalErrors}

👥 <b>Foydalanuvchilar:</b>
👤 Jami odamlar: ${totalUsers} ta
🔔 Obunachilar: ${subscribedUsers} ta
  `;
  
  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// Oddiy xabarlar va menyu tugmalari
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  stats.totalMessages += 1;

  if (msg.location) return;

  const user = users[chatId];
  const lang = user ? user.lang : 'uz';
  const t = texts[lang];

  if (msg.text === t.about_btn || msg.text === '/info') {
    bot.sendMessage(chatId, t.about_text, { parse_mode: 'HTML' });
  } 
  else if (msg.text === t.help_btn || msg.text === '/help') {
    bot.sendMessage(chatId, t.help_text, { parse_mode: 'HTML' });
  }
  else if (!msg.text.startsWith('/')) {
    bot.sendMessage(chatId, t.send_loc_request, { parse_mode: 'HTML' });
  }
});

// --- LOKATSIYA HANDLERI (IQAIR UCHUN SOZLANGAN) ---
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  const { latitude, longitude } = msg.location;
  
  if (!users[chatId]) users[chatId] = { lang: 'uz' };
  users[chatId].lastLoc = { lat: latitude, lon: longitude };
  saveUsers(users);

  const lang = users[chatId].lang;
  const t = texts[lang];

  try {
    // IQAIR API SO'ROVI
    const url = `http://api.airvisual.com/v2/nearest_city?lat=${latitude}&lon=${longitude}&key=${iqAirKey}`;
    const response = await axios.get(url);
    const data = response.data.data;
    
    if (data) {
      // IQAir ma'lumotlarini olish
      const aqi = data.current.pollution.aqius;
      const temp = data.current.weather.tp;     // Harorat
      const humidity = data.current.weather.hu; // Namlik
      const wind = data.current.weather.ws;     // Shamol
      const pressure = data.current.weather.pr; // Bosim (PM2.5 o'rniga ishlatamiz)

      let statusMsg = '';

      // Status tanlash
      if (aqi < 50) statusMsg = t.status.good;
      else if (aqi <= 100) statusMsg = t.status.mod;
      else if (aqi <= 150) statusMsg = t.status.bad;
      else statusMsg = t.status.haz;

      // Xabarni shakllantirish (Siz xohlagan format)
      const info = `
🌍 <b>AQI: ${aqi}</b>
${statusMsg}

📊 <b>Detallar:</b>
🌡 ${t.details.temp}: ${temp}°C
💧 ${t.details.hum}: ${humidity}%
💨 ${t.details.wind}: ${wind} m/s
🌫 ${t.details.pm}: ${pressure} hPa (Bosim)
      `;
      
      bot.sendMessage(chatId, info, { parse_mode: 'HTML', ...getMainMenu(lang) });
      stats.totalLocations += 1;
    } else {
      throw new Error("Data not found");
    }
  } catch (e) {
    console.error("IQAir Error:", e.response ? e.response.data : e.message);
    let errorText = lang === 'uz' ? "Ma'lumot olishda xatolik." : "Error fetching data.";
    if(e.response && e.response.status === 403) errorText += " (API Key Error)";
    
    bot.sendMessage(chatId, "⚠️ " + errorText);
    stats.totalErrors += 1;
  }
});

// Obuna bo'lish
bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  const lang = users[chatId]?.lang || 'uz';
  
  if(users[chatId] && users[chatId].lastLoc) {
    users[chatId].subscribed = true;
    saveUsers(users);
    const text = lang === 'uz' ? "✅ Obuna bo'ldingiz! Har kuni 08:00 da ma'lumot keladi." : 
                 (lang === 'ru' ? "✅ Вы подписались! Уведомления каждый день в 08:00." : "✅ Subscribed! Daily updates at 08:00.");
    bot.sendMessage(chatId, text);
  } else {
    const text = lang === 'uz' ? "⚠️ Obuna bo'lish uchun avval kamida 1 marta lokatsiya yuboring." : 
                 (lang === 'ru' ? "⚠️ Для подписки сначала отправьте локацию." : "⚠️ Send location first to subscribe.");
    bot.sendMessage(chatId, text);
  }
});

bot.onText(/\/unsubscribe/, (msg) => {
  const chatId = msg.chat.id;
  const lang = users[chatId]?.lang || 'uz';
  
  if(users[chatId]) {
    users[chatId].subscribed = false;
    saveUsers(users);
    const text = lang === 'uz' ? "🔕 Obuna bekor qilindi." : 
                 (lang === 'ru' ? "🔕 Подписка отменена." : "🔕 Unsubscribed.");
    bot.sendMessage(chatId, text);
  }
});

// Cron job (08:00) - IQAIR
cron.schedule('0 8 * * *', async () => {
  for (const id in users) {
    const u = users[id];
    if (u.subscribed && u.lastLoc && !u.blocked) {
      try {
        const url = `http://api.airvisual.com/v2/nearest_city?lat=${u.lastLoc.lat}&lon=${u.lastLoc.lon}&key=${iqAirKey}`;
        const res = await axios.get(url);
        const data = res.data.data;
        if(data) {
           const aqi = data.current.pollution.aqius;
           
           let emoji = "🟢";
           if(aqi > 50) emoji = "🟡";
           if(aqi > 100) emoji = "🟠";
           if(aqi > 150) emoji = "🔴";

           const txt = u.lang === 'uz' ? `☀️ Xayrli tong! Bugun AQI: ${aqi} ${emoji}` : 
                      (u.lang === 'ru' ? `☀️ Доброе утро! AQI сегодня: ${aqi} ${emoji}` : `☀️ Good morning! Today's AQI: ${aqi} ${emoji}`);
           bot.sendMessage(id, txt);
           stats.totalMessages += 1;
        }
      } catch (e) {
        if (e.response && e.response.status === 403) {
          users[id].blocked = true;
          saveUsers(users);
        }
        stats.totalErrors += 1;
      }
    }
  }
});

console.log('Bot muvaffaqiyatli ishga tushdi (IQAir)! 🚀');
