// driver.ts - Interface from drivers/engines to the controller

import { TilingDriver } from "./driver";
import { TilingEngineFactory, EngineType } from "../engines/factory";
import { Direction } from "../engines";
import { Client, Tile } from "../extern/kwin";

import { Controller } from "../controller";
import Log from "../util/log";
import Config from "../util/config";

export interface IDesktop
{
    screen: number;
    activity: string;
    desktop: number;
}

export class Desktop implements IDesktop
{
    screen: number;
    activity: string;
    desktop: number;
    toString(): string
    {
        return "(" + this.screen + ", " + this.activity + ", " + this.desktop + ")";
    }
    constructor(d: IDesktop)
    {
        this.screen = d.screen;
        this.activity = d.activity;
        this.desktop = d.desktop;
    }
    
    static fromClient(client: Client): Desktop[]
    {
        let ret = [];
        for (const activity of client.activities)
        {
            ret.push(new Desktop({
                screen: client.screen,
                activity: activity,
                desktop: client.desktop,
            }));
        }
        return ret;
    }
    
    static currentScreens(c: Controller): Desktop[]
    {
        let ret = [];
        for (let i = 0; i < c.workspace.numScreens; i += 1)
        {
            ret.push(new Desktop({
                screen: i,
                activity: c.workspace.currentActivity,
                desktop: c.workspace.currentDesktop,
            }));
        }
        return ret;
    }
}

export class DriverManager
{
    private drivers: Map<string, TilingDriver> = new Map;
    private engineFactory: TilingEngineFactory = new TilingEngineFactory();
    ctrl: Controller;
    buildingLayout: boolean = false;
    
    constructor(c: Controller)
    {
        this.ctrl = c;
    }
    private getDriver(desktop: Desktop): TilingDriver
    {
        const desktopString = desktop.toString();
        if (!this.drivers.has(desktopString))
        {
            const engineType = Config.engineType;
            const engine = this.engineFactory.newEngine(engineType);
            const driver = new TilingDriver(engine, engineType, this);
            this.drivers.set(desktopString, driver);
        }
        return this.drivers.get(desktopString)!;
    }
    
    rebuildLayout(scr?: number): void
    {
        this.buildingLayout = true;
        let desktops: Desktop[];
        if (scr == undefined)
        {
            desktops = Desktop.currentScreens(this.ctrl);
        }
        else
        {
            desktops = [new Desktop({
                screen: scr, 
                activity: this.ctrl.workspace.currentActivity, 
                desktop: this.ctrl.workspace.currentDesktop, 
            })];
        }
        for (const desktop of desktops)
        {
            const driver = this.getDriver(desktop);
            driver.buildLayout(this.ctrl.workspace.tilingForScreen(desktop.screen).rootTile);
        }
        this.buildingLayout = false;
    }
    
    addClient(client: Client, desktops?: Desktop[]): void
    {
        if (desktops == undefined)
        {
            desktops = Desktop.fromClient(client);
        }
        for (const desktop of desktops)
        {
            const driver = this.getDriver(desktop);
            driver.addClient(client);
        }
        client.isTiled = true;
    }
    
    removeClient(client: Client, desktops?: Desktop[]): void
    {
        if (desktops == undefined)
        {
            desktops = Desktop.fromClient(client);
        }
        for (const desktop of desktops)
        {
            const driver = this.getDriver(desktop);
            driver.removeClient(client);
        }
        client.isTiled = false;
    }
    
    putClientInTile(client: Client, tile: Tile, direction?: Direction)
    {
        const desktop = new Desktop(
        {
            screen: client.screen,
            activity: this.ctrl.workspace.currentActivity,
            desktop: this.ctrl.workspace.currentDesktop,
        });
        const driver = this.getDriver(desktop);
        driver.putClientInTile(client, tile, direction);
        client.isTiled = true;
    }
}
