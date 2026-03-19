export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(
    'https://api.github.com/repos/bec-archer/slack-tide/commits?per_page=50',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      next: { revalidate: 60 },
    }
  );
  const commits = await res.json();
  const formatted = commits.map((c: any) => ({
    hash: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
  }));
  return Response.json(formatted);
}
