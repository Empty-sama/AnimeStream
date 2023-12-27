import axios from 'axios';
import { load } from 'cheerio';
import { AnimeEpisode, AnimepaheSearch } from '../../Types';
import { Kwik } from '../Extractors';

export class Animepahe {
    constructor() {}

    public extractKwik = async (videoUrl: string): Promise<{ url: string; isM3U8: boolean }> => {
        const kwik = new Kwik();
        const stream = await kwik.extractKwik(videoUrl);
        return stream;
    };

    public getAnimepaheStreams = async (
        episodeUrl: string,
    ): Promise<{ link: string; server: string; quality: string }[]> => {
        const { data } = await axios.get(episodeUrl);
        const $ = load(data);
        const streams = $('div#resolutionMenu > button');
        const links: { link: string; server: string; quality: string }[] = [];

        streams.each((ind, ele) => {
            const data = $(ele);
            const link = data.attr('data-src') ?? '';
            const text = data.text();
            const server = text.split('·')[0]?.trim() ?? '';
            const quality = text.split('·')[1]?.trim() ?? '';
            links.push({
                link: link,
                server: server,
                quality: quality,
            });
        });

        return links;
    };

    public searchPahe = async (searchTerm: string): Promise<AnimepaheSearch[]> => {
        const base = `https://animepahe.ru/api?m=search&q=${searchTerm}`;
        const { data } = await axios.get(base);
        return data.data;
    };

    public getEpisodeInfo = async (session: string): Promise<AnimeEpisode[]> => {
        const mainArr: any[] = [];
        const url = `https://animepahe.ru/api?m=release&id=${session}&sort=episode_asc`;
        const { data } = await axios.get(url);
        mainArr.push(data.data);
        const totalPages = data.last_page;
        for (let i = 1; i < totalPages; i++) {
            const res = await axios.get(`${url}&page=${i + 1}`);
            mainArr.push(res.data);
        }
        const concArr: AnimeEpisode[] = [].concat(...mainArr);
        return concArr;
    };
    //do return `https://animepahe.ru/play/${session from search}/${session from episodeInfo} then pass it to kwik
}
