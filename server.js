const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
function renderPage(content) {
    const header = fs.readFileSync('./views/header.html', 'utf-8');
    const footer = fs.readFileSync('./views/footer.html', 'utf-8');

    return `
    <html>
    <head>
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        ${header}
        ${content}
        ${footer}
    </body>
    </html>
    `;
}

const logFile = './logs/app.log';

function writeLog(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

/* ---------------- ROUTES ---------------- */

app.get('/', (req, res) => {
    writeLog("Home page visited");
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    writeLog("Dashboard visited");
    res.sendFile(path.join(__dirname, 'public', 'pages', 'dashboard.html'));
});
app.get('/about', (req, res) => {
    writeLog("About page visited");
    const content = fs.readFileSync('./public/pages/about.html', 'utf-8');
    res.send(renderPage(content));
});

app.get('/projects', (req, res) => {
    writeLog("Projects page visited");
    res.sendFile(path.join(__dirname, 'public', 'pages', 'projects.html'));
});
app.get('/blog', (req, res) => {
    const posts = JSON.parse(fs.readFileSync('./data/posts.json'));

    let blogCards = posts.map(post => `
        <div class="blog-card">
            <h3>${post.title}</h3>
            <div class="blog-meta">${post.date} • ${post.tags.join(' • ')}</div>
            <p>${post.content[0]}</p>
            <a href="/blog/${post.id}" class="read-more">Read More →</a>
        </div>
    `).join('');

    res.send(`
        <html>
        <head>
            <link rel="stylesheet" href="/css/style.css">
            <title>Blog - Rajat Pandey</title>
        </head>
        <body>
            <nav>
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/projects">Projects</a>
                <a href="/blog">Blog</a>
                <a href="/dashboard">Dashboard</a>
                <a href="/contact">Contact</a>
            </nav>

            <section class="container">
                <h1 class="section-title">Engineering Blog</h1>
                <div class="blog-grid">
                    ${blogCards}
                </div>
            </section>
        </body>
        </html>
    `);
});
app.get('/blog/:id', (req, res) => {
    const posts = JSON.parse(fs.readFileSync('./data/posts.json'));
    const post = posts.find(p => p.id === req.params.id);

    if (!post) return res.send("Post not found");

    const paragraphs = post.content.map(p => `<p>${p}</p>`).join('');

    res.send(`
        <html>
        <head>
            <link rel="stylesheet" href="/css/style.css">
            <title>${post.title}</title>
        </head>
        <body>
            <nav>
                <a href="/">Home</a>
                <a href="/blog">Back to Blog</a>
            </nav>

            <section class="article">
                <h1>${post.title}</h1>
                <div class="blog-meta">${post.date} • ${post.tags.join(' • ')}</div>
                ${paragraphs}
            </section>
        </body>
        </html>
    `);
});


app.get('/contact', (req, res) => {
    writeLog("Contact page visited");
    res.sendFile(path.join(__dirname, 'public', 'pages', 'contact.html'));
});

/* ---------------- LOGS API ---------------- */

app.get('/api/logs', (req, res) => {
    fs.readFile(logFile, 'utf8', (err, data) => {
        if (err) return res.send("No logs yet...");
        const lines = data.trim().split("\n").slice(-50).join("\n");
        res.send(lines);
    });
});

/* ---------------- CPU API ---------------- */

function getCPUUsage() {
    const cpus = os.cpus();
    let idle = 0, total = 0;

    cpus.forEach(core => {
        for (type in core.times) total += core.times[type];
        idle += core.times.idle;
    });

    return { idle, total };
}

let startMeasure = getCPUUsage();

app.get('/api/cpu', (req, res) => {
    const endMeasure = getCPUUsage();
    const idleDiff = endMeasure.idle - startMeasure.idle;
    const totalDiff = endMeasure.total - startMeasure.total;
    const cpuUsage = 100 - Math.floor(100 * idleDiff / totalDiff);
    startMeasure = getCPUUsage();
    res.json({ cpu: cpuUsage });
});

/* ---------------- MEMORY API ---------------- */

app.get('/api/memory', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    res.json({
        total: (totalMem / 1024 / 1024).toFixed(2),
        used: (usedMem / 1024 / 1024).toFixed(2),
        free: (freeMem / 1024 / 1024).toFixed(2)
    });
});

/* ---------------- SYSTEM INFO API ---------------- */

app.get('/api/system', (req, res) => {
    res.json({
        hostname: os.hostname(),
        platform: os.platform(),
        uptime: (os.uptime() / 60).toFixed(2) + " minutes",
        cpus: os.cpus().length
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
