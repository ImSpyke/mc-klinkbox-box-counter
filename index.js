const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();

const DB = require('./db.js');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Get cookies
app.use((req, res, next) => {
    req.cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split('; ').map(c => c.split('='))) : {};
    next();
});

// App use log every request before and after with the returned status code
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`[${ip}] ${req.method} ${req.originalUrl} ${req.headers['user-agent']}`);
    res.on('finish', () => {
        console.log(`[${ip}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
    });
    next();
});

app.get('*stam', (req, res) => {

    // set a cookie
    // res.cookie('testCookie', 'testValue', { maxAge: 1000 * 60 * 60, httpOnly: true });

    if(req.path === '/favicon.ico') {
        res.status(204).send();
        return;
    }
    if(req.path === '/') {
        res.sendFile(__dirname + '/index.html');
        return;
    }

    if(req.url.startsWith('/api/')) {
        handleAPI(req, res);
        return;
    }

    res.status(404).send({ error: 'Not Found' });    
})



function filterSectionBoxesByPermission(boxes, permission) {
    /*
    boxes = {
                    "1 - Wood":     { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-1" },
                    "2 - Stone":    { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-2" },
                    "3 - Iron":     { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-3" },
                    "4 - Gold":     { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-4" },
                    "5 - Diamond":  { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-5" },
                    "6 - Emerald":  { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-6" },
                    "7 - Netherite":{ "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-7" },
                    "Deutsch":      { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-8" },
                    "Gelb":         { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-9" },
                    "Rot":          { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-10" },
                    "Limette":      { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-11" }
                }

    permissions = [ "box:1-1", "box:1-2", "box:1-3" ]
    */

    if(!boxes || !permission) return [];
    const filteredBoxes = {};
    for (const [key, value] of Object.entries(boxes)) {
        if (permission.includes(`box:${value.uuid}`)) {
            filteredBoxes[key] = {
                baseTimestamp: value.baseTimestamp,
                cooldownDuration: value.cooldownDuration,
                uuid: value.uuid,
                allowed: true
            }
        } else {
            filteredBoxes[key] = {
                baseTimestamp: 0,
                cooldownDuration: 0,
                uuid: value.uuid,
                allowed: false // Mark as not allowed
            };
        }
    }
    return filteredBoxes;
}

function filterSectionsWithPermissions(sections, permissions) {

    /*
    sections = {
        "name": {
            "boxes": {
                "1 - Wood": { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-1" },
                "2 - Stone": { "baseTimestamp": 1750516889000, "cooldownDuration": 60000, "uuid": "1-2" },
                // ...
            }
        },
        "name 2": {
            "boxes": {
                // ...
            }
        }
    }
    */

    if(!sections || !permissions) return {};
    
    const filteredSections = {};
    for (const [sectionName, sectionData] of Object.entries(sections)) {
        if (!sectionData.boxes) continue; // Skip sections without boxes
        const filteredBoxes = filterSectionBoxesByPermission(sectionData.boxes, permissions);
        if (Object.keys(filteredBoxes).length > 0) {
            filteredSections[sectionName] = { boxes: filteredBoxes };
        }
    }
    return filteredSections;

}


function handleAPI(req, res) {

    const isSuperAdmin = req.query.token === process.env.SUPER_ADMIN_TOKEN;
    

    if(req.path === '/api/sections') {
        
        let code = req.query.code;
        if(!code) {
            res.status(400).send({ error: 'Code is required' });
            return;
        }
        const db = DB.getDB();
        
        let sections = db.sections || null
        if(!sections) {
            res.status(404).send({ error: 'Section not found' });
            return;
        }

        let codeDatas = db.codes.find(c => c.code === code);
        /*
        codeDatas = {
            "uuid": "uuid",
            "name": "Free Access",
            "description": "Access to free sections 1 and 2",
            "code": "8 caracter code",
            "expires": "2026-01-01T12:00:00.000Z",
            "permissions": [
                "box:1-1", "box:1-2", "box:1-3", "box:1-4", "box:1-5", "box:1-6", "box:1-7", "box:1-8", "box:1-9", "box:1-10", "box:1-11",
                "box:2-1", "box:2-2", "box:2-3", "box:2-4"
            ]
        }
        */
        if(!codeDatas || codeDatas.expires < (new Date().toISOString())) {
            res.status(404).send({ error: `Invalid or expired code provided.` });
            return;
        }

        let filteredSections = filterSectionsWithPermissions(sections, codeDatas.permissions);

        return res.status(200).json({
            codeDatas: {
                code: codeDatas.code,
                name: codeDatas.name,
                description: codeDatas.description,
                expires: codeDatas.expires,
                permissions: codeDatas.permissions
            },
            sections: filteredSections
        });

    }

    if(req.path === '/api/db') {
        if(!isSuperAdmin) {
            res.status(403).send({ error: 'Forbidden' });
            return;
        }
        const db = DB.getDB();
        res.json(db);
        return;
    }


    res.status(404).send({ error: 'API endpoint not found' });
}



app.listen(process.env.PORT, () => console.log(`Klinkbox server running on port ${process.env.PORT}`));
