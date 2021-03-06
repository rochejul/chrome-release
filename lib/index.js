'use strict';

// Imports
const path = require('path');
const url = require('url');

const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const windowStateKeeper = require('electron-window-state');

const ChromeDownloader = require('./chrome-downloader');
const Logger = require('./logger');
const Constants = require('./constants');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Listen some basics events
  process.on('uncaughtException', err => {
    Logger.error(err);
  });

  process.on('unhandledRejection', (reason, p) => {
    Logger.error('Unhandled Rejection at: Promise', p, 'reason:', reason);
  });

  process.on('warning', warning => {
    Logger.warn(warning);
  });

  // Load the previous state with fallback to defaults
  let mainWindowState = windowStateKeeper({
    'defaultWidth': 900,
    'defaultHeight': 800,
    'maximize': true,
    'fullScreen': true,
    'path': Constants.BASE_DIRECTORY_PATH
  });

  // Setup the application
  ChromeDownloader.initDefaultRcFile();

  // Create the browser window.
  mainWindow = new BrowserWindow({
    'resizable': true,
    'fullscreenable': true,

    'minWidth': 450,
    'minHeight': 400,

    'x': mainWindowState.x,
    'y': mainWindowState.y,
    'width': mainWindowState.width,
    'height': mainWindowState.height,
    'fullscreen': mainWindowState.isFullScreen,

    'icon': path.resolve(path.join(__dirname, '../app/app.ico'))
  });

  // Disable menu
  mainWindow.setMenu(null);

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    'pathname': path.resolve(path.join(__dirname, '../app/index.html')),
    'protocol': 'file:',
    'slashes': true
  }));

  // Open the DevTools.
  if (process.env.NODE_ENV === 'dev') {
    // We are in development process
    require('devtron').install();
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // When a new window should be open
  mainWindow.webContents.on('new-window', (event, externalUrl) => {
    // stop Electron from opening another BrowserWindow
    event.preventDefault();
    // open the url in the default system browser
    shell.openExternal(externalUrl);
  });

  // Listen IPC events
  ipcMain.on('ipcEventProject--application-loaded', () => {
    // Load context
    let context = ChromeDownloader.loadContext();

    // Create the menu
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          'label': 'View',
          'submenu': [
            {
              'label': 'Display only donwloaded release',
              'type': 'checkbox',
              'checked': context.filterDownloadedRelease,
              'click': function (menuItem) {
                let firstBrowserWindow = BrowserWindow.getAllWindows()[0];
                firstBrowserWindow.webContents.send(
                  'ipcEventProject--menu-view-display-only-downloaded-release',
                  menuItem.checked
                );

                let context = ChromeDownloader.loadContext();
                ChromeDownloader.saveContext(
                  Object.assign(
                    context,
                    { 'filterDownloadedRelease': menuItem.checked }
                  )
                );
              }
            },
            {
              'label': 'Display filter bar by version',
              'type': 'checkbox',
              'checked': context.filterVersions,
              'click': function (menuItem) {
                let firstBrowserWindow = BrowserWindow.getAllWindows()[0];
                firstBrowserWindow.webContents.send(
                  'ipcEventProject--menu-view-display-filter-versions',
                  menuItem.checked
                );

                let context = ChromeDownloader.loadContext();
                ChromeDownloader.saveContext(
                  Object.assign(
                    context,
                    { 'filterVersions': menuItem.checked }
                  )
                );
              }
            }
          ]
        }
      ])
    );
  });
}

// Try to be sure to have only one instance
let shouldQuit = app.makeSingleInstance(() => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }
});

if (shouldQuit) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
