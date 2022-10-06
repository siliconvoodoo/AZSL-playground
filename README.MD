# Web application for AZSL Playground
It is a Node.js http server to compile shaders online.

Setup and launch:

### get an azslc binary:
from https://github.com/o3de/o3de-azslc or from o3de packages.

create a 1.8.8 (or other) folder at your home directory (or D:/bin for windows, or change it in server.js)  
and paste the azslc executable in there.  
You can make many folders and present access to multiple versions this way, the name in the GUI comes from the folder name.

### DXC
also paste dxc.exe, dxcompiler.dll, dxil.dll in your home/ or d:/bin (or change it in server.js)  

#### Astyle (optional)

Same as dxc, put astyle.exe in home

## to launch playground server
install node.js, then  
cd \<to playground folder in sources from repo\>  
If on linux, check that you have a recent wine version. or you'll get errors with VS redist dll and others.  
if needs be, follow these instructions https://wiki.winehq.org/Debian or https://wiki.winehq.org/Ubuntu
`sudo apt install --install-recommends winehq-devel`  
you can accelerate wine loading times by running `wine-preloader ~/dxc.exe`  

startup:
<pre><code>npm install
npm install forever -g
screen
cd <playground_path>
export WINEDEBUG=fixme-all
export DISPLAY=:0
forever start server.js
Ctrl+a+d</code></pre>

or `npm start server.js` for short if you don't need a long-time service.

from your browswer, access `localhost:3000` to profit.
