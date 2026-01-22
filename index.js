
const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.send('🚀 DevOps Engineer Dashboard API is Running');
});

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


app.get('/logs', (req, res) => {
    res.json({
        logs: [
            "App started successfully",
            "Connected to database",
            "Health check passed",
            "Metrics collected"
        ]
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
