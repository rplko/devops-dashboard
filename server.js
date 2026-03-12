const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

/* ---------------- STATIC FILES ---------------- */

app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- LOGGING ---------------- */

const logFile = './logs/app.log';

function writeLog(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

/* ---------------- PAGE RENDERER ---------------- */

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

/* ---------------- WEBSITE ROUTES ---------------- */

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

app.get('/contact', (req, res) => {
    writeLog("Contact page visited");
    res.sendFile(path.join(__dirname, 'public', 'pages', 'contact.html'));
});

/* ---------------- BLOG ---------------- */

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

/* ---------------- API ROUTES ---------------- */

app.get('/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});

app.get('/info', (req, res) => {
    res.json({
        hostname: os.hostname(),
        platform: os.platform(),
        uptime: os.uptime(),
        node_version: process.version
    });
});

app.get('/metrics', (req, res) => {

    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.json({
        free_memory: freeMem,
        total_memory: totalMem,
        used_memory: totalMem - freeMem,
        memory_usage_percent: (((totalMem - freeMem) / totalMem) * 100).toFixed(2),
        cpu_load: os.loadavg(),
        uptime: os.uptime()
    });

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

    let idle = 0;
    let total = 0;

    cpus.forEach(core => {

        for (type in core.times) {
            total += core.times[type];
        }

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
/* ---------------- METRICS API ---------------- */

app.get("/metrics/deployments", (req, res) => {
  res.json({
    deployments: process.env.DEPLOY_COUNT || 1,
    status: "success",
    timestamp: new Date()
  });
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

/* ---------------- SYSTEM INFO ---------------- */

app.get('/api/system', (req, res) => {

    res.json({

        hostname: os.hostname(),
        platform: os.platform(),
        uptime: (os.uptime() / 60).toFixed(2) + " minutes",
        cpus: os.cpus().length

    });

});

/* ---------------- DEPLOYMENT INFO ---------------- */

app.get('/api/deployment', async (req, res) => {

    try {

        const response = await axios.get(
            'https://api.github.com/repos/rplko/devops-dashboard/actions/runs'
        );

        const run = response.data.workflow_runs[0];

        res.json({

            status: run.conclusion,
            branch: run.head_branch,
            commit: run.head_sha.substring(0,7),
            time: run.updated_at

        });

    } catch (error) {

        res.json({ status: "Unable to fetch deployment info" });

    }

});

const { exec } = require("child_process");

app.get("/api/system-status", (req, res) => {

  const cpuLoad = os.loadavg()[0];
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = ((totalMem - freeMem) / totalMem * 100).toFixed(2);

  exec("docker ps --format '{{.Names}}'", (err, stdout) => {

    const containers = stdout
      .split("\n")
      .filter(c => c.length > 0);

    res.json({
      cpuLoad: cpuLoad.toFixed(2),
      memoryUsage: usedMem,
      runningContainers: containers.length,
      containerNames: containers,
      timestamp: new Date()
    });

  });

});
/* ---------------- START SERVER ---------------- */

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});