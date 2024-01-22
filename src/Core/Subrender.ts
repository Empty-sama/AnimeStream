import { ipcRenderer } from 'electron';
import { MAL, GogoStreams, AniList, Episodes, Animepahe } from '../Lib';
import { IDownloads, ISearchOutput, IStreams, Settings } from '../Types';
import Hls from 'hls.js';
import * as fs from 'fs';
import path from 'path';
import { clearRuntimeCache } from './CacheManager';
import { Downloader } from './Download';

const mal = new MAL();
const pahe = new Animepahe();
const anilist = new AniList();

const defaultSettings: Settings = {
    database: 'anilist',
    defaultStream: 'gogoanime',
    skipDuration: 5,
    defaultQuality: '720p',
    downloadPath: (process.env.USERPROFILE || process.env.HOME) + '\\Downloads\\',
};

export async function getAnimeInfo(linkOrId: string) {
    //add al info too
    const db = await getDataBase();
    let results;
    switch (db) {
        case 'anilist':
            results = await anilist.getAnimeInfo(linkOrId);
            break;
        case 'mal':
            results = mal.convertDataType(await mal.getAnimeInfo(linkOrId)); // need to format the output for mal
    }
    return results;
}

export async function searchResults(searchTerm: string) {
    const db = await getDataBase();
    if (db === 'anilist') {
        const res = await anilist.searchAnime(searchTerm);
        return res;
    }
    if (db === 'mal') {
        const res = await mal.jikanSearch(searchTerm);
        return res;
    }
    throw new Error('Error Finding The DataBase');
}

//set the link of clicked search result
export async function setClickableResult(link: string): Promise<void> {
    ipcRenderer.invoke('setCR', link);
    return;
}

//get clicked search result
export async function readClickedResult(): Promise<string> {
    const res: string = await ipcRenderer.invoke('readCR');
    if (!res) throw new Error('couldnt read shit get a life mf');
    return res;
}

//gogo search
export async function gogoSearch(term: string): Promise<ISearchOutput[]> {
    const gogo = new GogoStreams();
    const results = gogo.searchForAnime(term, true);
    return results;
}

//get gogo streams
export async function getGogoStreams(
    episodeId: string,
    quality?: '360' | '480' | '720' | '1080',
): Promise<IStreams[]> {
    const gogo = new GogoStreams();
    try {
        const results = await gogo.getStreams(episodeId, quality);
        return results;
    } catch (err) {
        console.log(err);
        throw new Error('Couldnt get any results');
    }
}

//animepahe search
export async function paheSearch(term: string) {
    const res = await pahe.searchPahe(term);
    return res;
}

export async function paheStreamDetails(session: string, episode: number) {
    const res = await pahe.getEpisodeInfo(session);
    return await getPaheStreamDetails(
        `https://animepahe.ru/play/${session}/${res[episode - 1].session}`,
    );
}

export async function getPaheStreamDetails(link: string) {
    const data = await pahe.getAnimepaheStreams(link);
    return data;
}

export async function getPaheStreams(streamLink: string) {
    const streams = await pahe.extractKwik(streamLink);
    return streams;
}

export async function stream(videoElement: HTMLVideoElement, src: string) {
    if (!videoElement) throw new Error('ERRRRRRR');
    try {
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(src);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, function () {});
        }
    } catch (err) {
        throw new Error();
    }
}

export async function storeEpisodeId(epId: string): Promise<void> {
    await ipcRenderer.invoke('setEpisodeId', epId);
}

export async function getStoredEpisodeId(): Promise<string> {
    const id = ipcRenderer.invoke('getEpisodeId');
    return id;
}

export async function createNewWindow(downloads?: boolean) {
    await ipcRenderer.invoke('createNewWindow', downloads);
}

export async function readSettings() {
    const settingPath = await ipcRenderer.invoke('getSettingPath');
    if (!fs.existsSync(path.join(settingPath, './settings.json'))) {
        fs.writeFileSync(
            path.join(settingPath, './settings.json'),
            JSON.stringify(defaultSettings, null, 2),
        );
    }
    const settings = JSON.parse(
        fs.readFileSync(`${settingPath}/settings.json`, 'utf8'),
    ) as Settings;
    return settings;
}

async function fixSettingsError() {
    const setting = await readSettings();
    const replica = setting as any;
    const currentKeys = Object.keys(setting) as (keyof Settings)[];
    const defaultKeys = Object.keys(defaultSettings) as (keyof Settings)[];
    if (currentKeys.length !== defaultKeys.length) {
        defaultKeys.forEach((key) => {
            if (!setting[key]) {
                replica[key] = defaultSettings[key];
            }
        });
    }
    await writeSettings(replica as Settings);
}

export async function writeSettings(setting: Settings) {
    try {
        const stringy = JSON.stringify(setting, null, 2);
        fs.writeFileSync(`${await ipcRenderer.invoke('getSettingPath')}/settings.json`, stringy);
    } catch (err) {
        console.log(err);
        await fixSettingsError();
    }
}

export async function readDownload() {
    const settingPath = await ipcRenderer.invoke('getSettingPath');
    if (!fs.existsSync(path.join(settingPath, './downloads.json'))) {
        fs.writeFileSync(path.join(settingPath, './downloads.json'), JSON.stringify('[]', null, 2));
    }
    const downloads = JSON.parse(
        fs.readFileSync(`${settingPath}/downloads.json`, 'utf8'),
    ) as IDownloads[];
    return downloads;
}

export async function writeDownloads(downloads: IDownloads) {
    try {
        const stringy = JSON.stringify(downloads, null, 2);
        fs.writeFileSync(`${await ipcRenderer.invoke('getSettingPath')}/downloads.json`, stringy);
    } catch (err) {
        console.log(err);
        await fixSettingsError();
    }
}

export async function setBackTo(to: string) {
    await ipcRenderer.invoke('setBackTo', to);
}

export async function getBackTo(): Promise<string> {
    return await ipcRenderer.invoke('getBackTo');
}

export const Path = path;

export async function getMALLatestAnime() {
    const res = await mal.fetchLatestAnime();
    return res;
}

export async function getALLatestAnime() {
    const res = await anilist.getThisSeason();
    return res;
}

export async function storeAnimeData(data: string) {
    await ipcRenderer.invoke('storeAnimeData', data);
}

export async function getStoredAnimeData() {
    const res = await ipcRenderer.invoke('getStoredAnimeData');
    return res;
}

export async function getDataBase() {
    const settings = await readSettings();
    return settings.database;
}

export async function getDefaultStream() {
    const settings = await readSettings();
    return settings.defaultStream;
}

export async function changeDefaultStream(stream: 'animepahe' | 'gogoanime') {
    const settings = await readSettings();
    settings.defaultStream = stream;
    return await writeSettings(settings);
}

export async function changeDefaultQuality(quality: '360p' | '480p' | '720p' | '1080p') {
    const settings = await readSettings();
    settings.defaultQuality = quality;
    return await writeSettings(settings);
}

export async function getEpisodeLink(aliasId: string) {
    const gogo = new GogoStreams();
    const res = await gogo.getAnimeEpisodeLink(aliasId);
    return res;
}

export async function changeDataBase(db: 'mal' | 'anilist') {
    const settings = await readSettings();
    settings.database = db;
    await writeSettings(settings);
    clearRuntimeCache();
    await reload();
}

export async function changeDownloadPath(path: string) {
    if (!fs.existsSync(path)) throw new Error('Path specified doesnt exist');
    const settings = await readSettings();
    settings.downloadPath = path;
    await writeSettings(settings);
}

export async function getEpisodes(infoLink: string) {
    const ep = new Episodes();
    const eps = await ep.getAiredEpisodes(infoLink, await getDataBase());
    return eps;
}

export async function getEpisodesFromSite(animeName: string) {
    const ep = await new Episodes();
    const eps = await ep.getAiredEpisodesFromSite(animeName, await getDefaultStream());
    return eps;
}

export async function getAnilistLink() {
    const res = await ipcRenderer.invoke('getStoredAnilistLink');
    return res;
}

export async function getAnilistInfo(anilistId: string) {
    const data = await anilist.getALInfo(anilistId);
    return data;
}

export async function setAnilistLink(link: string) {
    return void (await ipcRenderer.invoke('setAnilistLink', link));
}

export async function getMalIdWithAlId(id: string) {
    return await anilist.getMalIdFromAlId(parseInt(id));
}

export async function storeTotalEpisodes(episodes: string) {
    return void (await ipcRenderer.invoke('storeTotalEpisodes', episodes));
}

export async function getStoredTotalEpisodes() {
    const res = ipcRenderer.invoke('getStoredTotalEpisodes');
    return res;
}

export async function getAppDetails(): Promise<{ version: string; name: string }> {
    const res = await ipcRenderer.invoke('getAppDetails');
    return res;
}

export async function reload() {
    await ipcRenderer.invoke('reloadMain');
}

export async function setDefaultSkipTime(duration: number) {
    const settings = await readSettings();
    settings.skipDuration = duration < 60 ? duration : 60;
    await writeSettings(settings);
}

export async function getSearchMemory() {
    const res = await ipcRenderer.invoke('getSearchMemory');
    if (!res) throw new Error('Recieved search memory as undefined');
    return res;
}

export async function storeSearchMemory(divHTML: string) {
    return await ipcRenderer.invoke('storeSearchMemory', divHTML);
}

export async function downloader(m3u8Link: string, title: string) {
    let downloadPath = (await readSettings()).downloadPath;
    if (!downloadPath) {
        await fixSettingsError();
        downloadPath = (await readSettings()).downloadPath;
    }
    const downloader = new Downloader(m3u8Link, `${downloadPath}${title}.mp4`);
    return downloader;
}
