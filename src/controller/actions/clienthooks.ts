import * as Kwin from "../../extern/kwin";
import { QTimer } from "../../extern/qt";
import { Controller } from "../";
import { Desktop } from "../../driver";
import Log from "../../util/log";
import Config from "../../util/config";

export function attachClientHooks(this: Controller, client: Kwin.Client)
{
    if (client.hooksRegistered)
    {
        return;
    }
    client.hooksRegistered = true;
    client.previousDesktops = Desktop.fromClient(client);
    client.desktopChanged.connect(clientDesktopChanged.bind(this, client));
    client.activitiesChanged.connect(clientDesktopChanged.bind(this, client));
    client.screenChanged.connect(clientDesktopChanged.bind(this, client));
    client.tileChanged.connect(clientTileChanged.bind(this, client));
}

function clientDesktopChanged(this: Controller, client: Kwin.Client)
{
    if (client.previousDesktops == undefined || !client.isTiled)
    {
        return;
    }
    const currentDesktops = Desktop.fromClient(client);
    const removeDesktops = [];
    for (const desktop of client.previousDesktops)
    {
        if (!currentDesktops.includes(desktop))
        {
            removeDesktops.push(desktop);
        }
    }
    this.manager.removeClient(client, removeDesktops);
    const addDesktops = [];
    for (const desktop of currentDesktops)
    {
        if (!client.previousDesktops.includes(desktop))
        {
            addDesktops.push(desktop);
        }
    }
    this.manager.addClient(client, addDesktops);
    client.previousDesktops = currentDesktops;
    this.manager.rebuildLayout();
}

function clientTileChanged(this: Controller, client: Kwin.Client)
{
    // dont react to geometry changes while the layout is rebuilding
    if (this.manager.buildingLayout) return;
    // have to use timers because kwin is lazy
    const timer = this.qmlObjects.root.createTimer();
    timer.triggeredOnStart = false;
    timer.repeat = false;
    timer.interval = Config.timerDelay;
    timer.triggered.connect(clientTileChangedCallback.bind(this, client, timer));
    timer.start();
}

function clientTileChangedCallback(this: Controller, client: Kwin.Client, timer: QTimer)
{
    const inManagedTile = (client.tile != null) && (client.tile.managed == true);
    
    // client is moved into managed tile from outside
    if (!client.isTiled && inManagedTile)
    {
        Log.debug("Putting client", client.resourceClass, "in tile", client.tile!.absoluteGeometry);
        attachClientHooks.bind(this)(client);
        this.manager.putClientInTile(client, client.tile!);
        this.manager.rebuildLayout(client.screen);
    }
    // client is moved out of a managed tile and into no tile
    else if (client.isTiled && !inManagedTile && client.tile == null)
    {
        Log.debug("Client", client.resourceClass, "was moved out of a tile");
        this.manager.removeClient(client);
        this.manager.rebuildLayout(client.screen);
    }
    
    // clean up timer
    timer.destroy();
}
