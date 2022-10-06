// zlib licence
// copyright Vivien Oddou 2020

const express = require('express');
let isWin = process.platform === "win32";
const port = 3000;
var serveStatic = require('serve-static');
var tmp = require('tmp');
var tmp2 = require('tmp');
const path = require('path');
const child_process = require('child_process');
var fs = require('fs');
const { readdirSync, statSync } = fs;
const bs58 = require('bs58');
var expandTilde = require('expand-tilde');
const basicAuth = require('express-basic-auth');

const app = express();
app.use(serveStatic('ace'));
app.use(serveStatic('node_modules/bootstrap/dist/'));
app.use(serveStatic('node_modules/bootstrap-toggle/css'));
app.use(serveStatic('node_modules/bootstrap-toggle/js'));
app.use(serveStatic('node_modules/jquery/dist/'));
var tmpobj = tmp.fileSync();
var tmpobj2 = tmp2.fileSync();

app.get('/', (req, res) => res.sendFile(path.resolve('index.html')));

const { join } = require('path');

function getBaseDir(){
    let home = isWin ? "%HOMEPATH%" : expandTilde('~');
    basedir = isWin ? "D:/bin" : home;
    return basedir;
}

function getDirsAt(p){
    return readdirSync(p).filter(f => statSync(join(p, f)).isDirectory() && !f.startsWith('.'));  // .stuff is hidden
}

function isFileElfBinary(file){
    try{
	if (isWin) return false;
	let cmd = "file -b " + file;
	let stdout = child_process.execSync(cmd, { timeout: 800 });
	return stdout.toString().startsWith("ELF");
    } catch(e) { return false; }
}

function isExe(file){
    return path.extname(file) === '.exe' || isFileElfBinary(file);
}

function getCompilers(){
    let basedir = getBaseDir();
    let validDirs = getDirsAt(basedir).filter(d => fs.readdirSync(join(basedir, d)).some(f => isExe(join(basedir, d, f))));
    return validDirs;
}

// compilerName should come from one of the stuff listed by getCompilers.
function getCompilerPath(compilerName) {
    let baseDir = getBaseDir();
    dir = join(basedir, compilerName);
    exeAttempt = join(dir, "azslc.exe");
    if (fs.existsSync(exeAttempt))
        return exeAttempt;
    binAttempt = join(dir, "azslc");
    return binAttempt;
}

function makeExePath(p){
    if (!isFileElfBinary(p))
        return p + ".exe";
    return p;
}

function makeBinCmd(p){
    if (!isWin){
        if (path.extname(p) === '.exe')
            return "DISPLAY=:0 wine " + p;
    }
    return p;
}

// http API
app.get('/compilers', (req, res) => {
    res.json(getCompilers());
    res.end();
});

app.post('/build', (req, res) => {
    let body = [];  // we must construct the body progressively as data streams in from the client
    req.on('data', (chunk) => {
        body.push(chunk);  // body variable is "closed" by the lambda capture, so concurrent request will not messup state.
    }).on('end', () => {
        let home = isWin ? "%HOMEPATH%" : expandTilde('~');
        let callback = function (error, stdout, stderr) {
            let azslok = error === null
            if (azslok && req.query.astyle == "true") { // format required
                let callback2 = function (error2, stdout2, stderr2) {
                    console.log('formatted 2 step build done');
                    if (error2)
                        res.json({ ok: false, out: stdout, err: `astyle failed with ${stderr2}` });
                    else
                        res.json({ ok: azslok, out: stdout2, err: stderr });
                    res.end();
                };
                fs.truncateSync(tmpobj.name, 0);
                fs.writeFileSync(tmpobj.name, stdout);
                let astyle = isWin ? "D:/bin/astyle.exe" : "~/astyle";

                let cmd2 = astyle + " --stdin=" + tmpobj.name + " --options=" + (isWin ? "D:/bin/astyle.cfg" : home + "/astyle.cfg");
                child_process.exec(cmd2, { timeout: 3000 }, callback2);
            }
            else {
                // answer back to browser here
                console.log('simple build done');
                res.json({ ok: azslok, out: stdout, err: stderr });
                res.end();
            }
        };

        // prepare path to azslc executable:
        var reqcomp = req.query.compiler;  // the requested version from the client
        var path2comp = getBaseDir();  // startup path: the place where the server has exe tools.
        if (reqcomp) path2comp = join(path2comp, reqcomp);
        path2comp = join(path2comp, "azslc");  // add binary name
        path2comp = makeExePath(path2comp);  // add extension if necessary
        let azslc = makeBinCmd(path2comp);  // prepend wine emulator if necessary

        // get source and build
        body = Buffer.concat(body).toString();
        var source = bs58.decode(body);
        // put source in file and call compiler on it. (the file is not per user session, but node.js is single threaded)
        fs.truncateSync(tmpobj.name, 0);
        fs.writeFileSync(tmpobj.name, source);
        let cmdline = bs58.decode(req.query.args);
        let cmd = azslc + " " + tmpobj.name + " " + cmdline;

        // run. (and treat result in the callback registered above)
        child_process.exec(cmd, { timeout: 10000 }, callback);
    });
});

app.post('/build_dxc', (req, res) => {
    let cmdline = bs58.decode(req.query.args);
    let body = [];
    req.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        body = Buffer.concat(body).toString();
        var source = bs58.decode(body);
        try{fs.closeSync(tmpobj2.fd);} catch (err) { }
        tmpobj2.fd = fs.openSync(tmpobj2.name, "w+");
        fs.truncateSync(tmpobj2.name, 0);
        fs.writeFileSync(tmpobj2.name, source);
        fs.closeSync(tmpobj2.fd);

        let dxc = isWin ? "D:/bin/dxc.exe" : "wine64 ~/dxc.exe";
        let callback = function (error, stdout, stderr) {
            let dxcok = error === null
            console.log('dxc build done');
            res.json({ ok: dxcok, out: stdout, err: stderr }); // answer back to browser here
	    res.end();
        };
        let cmd = dxc + " " + cmdline + " " + tmpobj2.name;  // [options] <input>
        child_process.exec(cmd, { timeout: 10000 }, callback);
    });
});

app.listen(port, () => console.log(`Playground app listening on port ${port}!`));
