import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const revalidate = 30

export async function GET() {
  try {
    const output = execSync(
      'git log --pretty=format:"%H|%s|%an|%ae|%ar|%at" -50',
      { cwd: process.cwd(), encoding: 'utf-8', timeout: 5000 }
    )

    const commits = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, author, email, relativeTime, timestamp] = line.split('|')
        return { hash, message, author, email, relativeTime, timestamp: Number(timestamp) }
      })

    return NextResponse.json(commits)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
