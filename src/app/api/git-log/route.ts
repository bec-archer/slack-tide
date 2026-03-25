export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const repo = searchParams.get('repo')

  if (!repo) {
    return Response.json({ error: 'Missing ?repo= parameter' }, { status: 400 })
  }

  const token = process.env.GITHUB_TOKEN
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  )

  if (!res.ok) {
    return Response.json(
      { error: `GitHub API error: ${res.status}` },
      { status: res.status }
    )
  }

  const commits = await res.json()
  const formatted = commits.map((c: any) => ({
    hash: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
  }))
  return Response.json(formatted)
}
