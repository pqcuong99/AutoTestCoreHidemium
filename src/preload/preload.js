/**
 * Cau noi an toan giua renderer va main (contextIsolation = true).
 * Dung chung cho ca cua so chinh va popup Detail Log.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch) => ipcRenderer.invoke('config:set', patch),
  },
  meta: {
    all: () => ipcRenderer.invoke('meta:all'),
  },
  profiles: {
    list: (payload) => ipcRenderer.invoke('profiles:list', payload),
  },
  profile: {
    readConfig: (profilePath) => ipcRenderer.invoke('profile:read-config', profilePath),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },
  automation: {
    // Man Automation la lop phu trong cua so chinh -> viec mo/dong do renderer
    // tu lo qua window.AutomationApp, khong can di qua IPC.
    list: () => ipcRenderer.invoke('automation:list'),
    get: (id) => ipcRenderer.invoke('automation:get', id),
    save: (script) => ipcRenderer.invoke('automation:save', script),
    remove: (id) => ipcRenderer.invoke('automation:remove', id),
    run: (flow) => ipcRenderer.invoke('automation:run', flow),
    stop: () => ipcRenderer.invoke('automation:stop'),
    status: () => ipcRenderer.invoke('automation:status'),
    onEvent: (handler) => {
      const listener = (_e, evt) => handler(evt);
      ipcRenderer.on('automation:event', listener);
      return () => ipcRenderer.removeListener('automation:event', listener);
    },
  },
  run: {
    start: (payload) => ipcRenderer.invoke('run:start', payload),
    stop: () => ipcRenderer.invoke('run:stop'),
    status: () => ipcRenderer.invoke('run:status'),
    onEvent: (handler) => {
      const listener = (_e, evt) => handler(evt);
      ipcRenderer.on('run:event', listener);
      return () => ipcRenderer.removeListener('run:event', listener);
    },
  },
});
