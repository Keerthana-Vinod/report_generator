console.log('Booting WhatsApp automation service...');
const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const QRCode = require('qrcode');

require('fs').writeFileSync('qr.js', 'window.qrData = "";');

const db = {
  polls: {}
};

const savePoll = async (poll) => {
  db.polls[poll.id] = poll;
};

const getPoll = async (id) => {
  return db.polls[id];
};

const getPollsByDateAndGroup = async (date) => {
  return Object.values(db.polls).filter(p => p.date === date);
};

const getLocalDateString = (offsetDays = 0) => {
  const date = new Date();
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTasks = (text) => {
  const taskRegex = /(?:^|\s)(\d+)[\.\)]\s*(.+?)(?=(?:\s*,?\s*\d+[\.\)])|[\r\n]|$)/g;
  const tasks = [];
  let match;
  while ((match = taskRegex.exec(text)) !== null) {
    tasks.push({
      number: match[1],
      description: match[2].trim()
    });
  }
  return tasks;
};

const extractNameFromMessage = (body) => {
  const firstTaskIndex = body.search(/(?:^|\s)1[\.\)]/);
  let textBeforeTasks = body;
  if (firstTaskIndex !== -1) {
    textBeforeTasks = body.substring(0, firstTaskIndex);
  }

  const lines = textBeforeTasks.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    const explicitNameMatch = line.match(/^(?:name|employee|user|member|person)\s*[:\-]\s*(.+)$/i);
    if (explicitNameMatch) {
      return explicitNameMatch[1].replace(/[*:\-_#]/g, '').trim();
    }

    const dashMatch = line.match(/(?:tasks?|status|report|today|tomorrow|yesterday)\s*-\s*([a-zA-Z\s*#]+)/i);
    if (dashMatch) {
      const name = dashMatch[1].replace(/[*:\-_#]/g, '').trim();
      if (name.length > 0 && name.length < 30 && /^[a-zA-Z\s]+$/.test(name)) {
        return name;
      }
    }

    const dashMatchReverse = line.match(/^([a-zA-Z\s*#]+)\s*-\s*(?:tasks?|status|report|today|tomorrow|yesterday)/i);
    if (dashMatchReverse) {
      const name = dashMatchReverse[1].replace(/[*:\-_#]/g, '').trim();
      if (name.length > 0 && name.length < 30 && /^[a-zA-Z\s]+$/.test(name)) {
        return name;
      }
    }

    // 3. Patterns like "Tasks of Rahul", "Rahul's tasks", "Rahul tasks", "M S Arjun Today's Works"
    const cleanLine = line.replace(/'/g, ''); // strip apostrophes first

    // Pattern 3a: with a day mention: e.g., "Arjun Todays Works"
    const withDayMatch = cleanLine.match(/^([a-zA-Z\s]+?)\s+(?:todays?|tomorrows?|yesterdays?)\s+(?:works?|tasks?|status|report)/i);
    if (withDayMatch) {
      const name = withDayMatch[1].trim();
      const lowerName = name.toLowerCase();
      if (
        !lowerName.includes('task') &&
        !lowerName.includes('status') &&
        !lowerName.includes('report') &&
        !lowerName.includes('today') &&
        !lowerName.includes('tomorrow') &&
        !lowerName.includes('yesterday') &&
        !lowerName.includes('work')
      ) {
        return name;
      }
    }

    // Pattern 3b: without a day mention: e.g., "Arjun Works"
    const withoutDayMatch = cleanLine.match(/^([a-zA-Z\s]+?)\s+(?:works?|tasks?|status|report)/i);
    if (withoutDayMatch) {
      const name = withoutDayMatch[1].trim();
      const lowerName = name.toLowerCase();
      if (
        !lowerName.includes('task') &&
        !lowerName.includes('status') &&
        !lowerName.includes('report') &&
        !lowerName.includes('today') &&
        !lowerName.includes('tomorrow') &&
        !lowerName.includes('yesterday') &&
        !lowerName.includes('work')
      ) {
        return name;
      }
    }

    const tasksOfMatch = line.match(/(?:tasks?|status|report)\s+(?:of|for|by)\s+([a-zA-Z\s]+)/i);
    if (tasksOfMatch) {
      return tasksOfMatch[1].trim();
    }

    const nameTasksMatch = line.match(/^([a-zA-Z\s]+)\s+(?:tasks?|status|report)/i);
    if (nameTasksMatch) {
      return nameTasksMatch[1].trim();
    }

    const lowerLine = line.toLowerCase();
    if (
      lowerLine.includes('tasks') ||
      lowerLine.includes('status') ||
      lowerLine.includes('report') ||
      lowerLine.includes('today') ||
      lowerLine.includes('tomorrow') ||
      lowerLine.includes('yesterday') ||
      lowerLine.includes('work') ||
      lowerLine.includes('update') ||
      lowerLine.includes('list')
    ) {
      continue;
    }

    const cleanedLine = line.replace(/[*:\-_#]/g, '').trim();
    if (cleanedLine.length > 0 && cleanedLine.length < 30 && /^[a-zA-Z\s]+$/.test(cleanedLine)) {
      return cleanedLine;
    }
  }

  return null;
};

const generateDailyReport = async (chatId, dateStr) => {
  const polls = await getPollsByDateAndGroup(dateStr);
  const groupPolls = polls.filter(p => p.chatId === chatId);
  if (groupPolls.length === 0) {
    return `📋 *Task Audit Report - ${dateStr}*\n\nNo task polls found for this date.`;
  }

  const authorTasks = {};
  for (const poll of groupPolls) {
    if (!authorTasks[poll.authorName]) {
      authorTasks[poll.authorName] = [];
    }
    authorTasks[poll.authorName].push(...poll.tasks);
  }

  let report = `📋 *Daily Task Audit Report - ${dateStr}*\n\n`;
  for (const [authorName, tasks] of Object.entries(authorTasks)) {
    report += `👤 *${authorName}*\n`;
    for (const task of tasks) {
      const statusEmoji = task.completed ? '✅' : '❌';
      report += `${statusEmoji} ${task.optionName}\n`;
    }
    report += '\n';
  }
  return report.trim();
};

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  require('fs').writeFileSync('qr.js', `window.qrData = "${qr}";`);
  QRCode.toFile('qr.png', qr, {
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    },
    width: 300
  }, (err) => {
    if (err) console.error('Error generating qr.png:', err);
  });
});

client.on('ready', () => {
  console.log('WhatsApp Web Client is ready!');
  require('fs').writeFileSync('qr.js', 'window.qrData = "";');
  try {
    if (require('fs').existsSync('qr.png')) {
      require('fs').unlinkSync('qr.png');
    }
  } catch (err) {
    console.error('Error deleting qr.png:', err);
  }
});

client.on('auth_failure', (msg) => {
  console.error('Authentication failure:', msg);
});

client.on('disconnected', (reason) => {
  console.log('Client was logged out:', reason);
  client.initialize().catch(err => console.error('Failed to re-initialize:', err));
});

client.on('message_create', async (msg) => {
  console.log(`Msg event: fromMe=${msg.fromMe}, body=${msg.body ? msg.body.substring(0, 30) : 'empty'}`);
  if (!msg.body) return;

  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;
    console.log(`Group: ${chat.name}, Body: ${msg.body}`);
    if (chat.name !== 'Work Status') return;

    // Prevent bot from replying to its own status/poll messages
    if (msg.fromMe && msg.body.includes('📋')) return;

    const tasks = parseTasks(msg.body);
    console.log(`Parsed tasks: ${tasks.length}`, tasks);

    if (tasks.length === 0) {
      const isReportRequest = /\b(report|status)\b/i.test(msg.body) && msg.body.length < 30;
      if (isReportRequest) {
        let offset = 0;
        if (/yesterday/i.test(msg.body)) {
          offset = -1;
        } else if (/tomorrow/i.test(msg.body)) {
          offset = 1;
        }
        const targetDate = getLocalDateString(offset);
        const report = await generateDailyReport(msg.from, targetDate);
        await msg.reply(report);
      }
      return;
    }

    const isTomorrow = /tomorrow/i.test(msg.body);
    const targetDate = getLocalDateString(isTomorrow ? 1 : 0);

    const authorContact = await msg.getContact();
    const authorName = authorContact.pushname || authorContact.name || (msg.author ? msg.author.split('@')[0] : 'Employee');
    const authorId = msg.author || (msg.fromMe ? client.info.wid._serialized : msg.from);

    const extractedName = extractNameFromMessage(msg.body);
    const displayName = extractedName || authorName;

    const maxOptions = 10;
    const pollChunks = [];
    for (let i = 0; i < tasks.length; i += maxOptions) {
      pollChunks.push(tasks.slice(i, i + maxOptions));
    }

    for (let idx = 0; idx < pollChunks.length; idx++) {
      const chunk = pollChunks[idx];
      const partSuffix = pollChunks.length > 1 ? ` (${idx + 1}/${pollChunks.length})` : '';
      const pollTitle = `📋 Tasks: ${displayName}${partSuffix} (${targetDate})`;
      const pollOptions = chunk.map(t => `${t.number}. ${t.description}`);

      const poll = new Poll(pollTitle, pollOptions, { allowMultipleAnswers: true });
      const pollMsg = await msg.reply(poll);

      const pollId = pollMsg.id._serialized;
      await savePoll({
        id: pollId,
        chatId: msg.from,
        authorName: displayName,
        authorId,
        date: targetDate,
        tasks: pollOptions.map(opt => ({ optionName: opt, completed: false }))
      });
    }
  } catch (err) {
    console.error('Error handling incoming message:', err);
  }
});

client.on('vote_update', async (vote) => {
  try {
    const pollId = vote.parentMsgKey._serialized;
    const poll = await getPoll(pollId);
    if (!poll) return;

    poll.voterSelections = poll.voterSelections || {};
    
    // Map selected options using name or index/localId
    poll.voterSelections[vote.voter] = vote.selectedOptions.map(opt => {
      if (opt.name) return opt.name;
      if (opt.localId !== undefined && poll.tasks[opt.localId]) {
        return poll.tasks[opt.localId].optionName;
      }
      return null;
    }).filter(Boolean);

    const allSelectedOptions = new Set(Object.values(poll.voterSelections).flat());
    for (const task of poll.tasks) {
      task.completed = allSelectedOptions.has(task.optionName);
    }
  } catch (err) {
    console.error('Error handling vote update:', err);
  }
});

cron.schedule('5 18 * * *', async () => {
  try {
    const todayStr = getLocalDateString(0);
    const polls = await getPollsByDateAndGroup(todayStr);

    const chatsMap = {};
    for (const poll of polls) {
      if (!chatsMap[poll.chatId]) {
        chatsMap[poll.chatId] = [];
      }
      chatsMap[poll.chatId].push(poll);
    }

    for (const chatId of Object.keys(chatsMap)) {
      const report = await generateDailyReport(chatId, todayStr);
      await client.sendMessage(chatId, report);
    }
  } catch (err) {
    console.error('Error executing daily audit cron:', err);
  }
});

client.initialize().catch(err => {
  console.error('Initialization error:', err);
});
