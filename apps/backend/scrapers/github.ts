import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

// The proxy is optional: only use it when PROXY_URL is set.
const httpsAgent = process.env.PROXY_URL ? new HttpsProxyAgent(process.env.PROXY_URL) : undefined;
const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : undefined;

/** Accepts "https://github.com/user", "github.com/user/repo", "@user" or "user" and returns "user". */
export function parseGithubUsername(input: string): string | null {
    const trimmed = input.trim().replace(/^@/, "");
    const match = trimmed.match(/github\.com\/([A-Za-z0-9-]+)/i);
    const username = match ? match[1] : trimmed;
    return username && /^[A-Za-z0-9-]{1,39}$/.test(username) ? username : null;
}

export async function scrapeGithub(username: string) {
    const userRepos = await axios.request({
        url: `https://api.github.com/users/${username}/repos?sort=updated&per_page=30`,
        httpsAgent,
        headers,
    });
    return userRepos.data.map((x: any) => ({
        description: x.description,
        name: x.name,
        fullName: x.full_name,
        starCount: x.stargazers_count,
        language: x.language,
        topics: x.topics,
        fork: x.fork,
        updatedAt: x.updated_at,
    }));
}

/** Profile + repos, used by the practice flow. */
export async function scrapeGithubProfile(username: string) {
    const [profile, repos] = await Promise.all([
        axios.request({ url: `https://api.github.com/users/${username}`, httpsAgent, headers }),
        scrapeGithub(username),
    ]);
    const p = profile.data;
    return {
        username: p.login,
        name: p.name,
        bio: p.bio,
        publicRepos: p.public_repos,
        followers: p.followers,
        repos,
    };
}
