export async function sendRequest(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<unknown> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
  console.log(path, method);

  try {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  } catch (e) {
    if (e.response.status < 400) {
      return e.response;
    }
    throw e;
  }
}

export function parsePullRequestId(githubRef = process.env.GITHUB_REF ?? ''): string | undefined {
  const result = /refs\/pull\/(\d+)\/merge/g.exec(githubRef);
  return result?.[1];
}
