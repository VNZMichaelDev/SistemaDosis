import type { NextRequest } from 'next/server'
import { handleApi } from '@/server/router'
import '@/server/routes'

export function GET(req: NextRequest) {
  return handleApi(req, req.nextUrl.pathname)
}
export function POST(req: NextRequest) {
  return handleApi(req, req.nextUrl.pathname)
}
export function PUT(req: NextRequest) {
  return handleApi(req, req.nextUrl.pathname)
}
export function DELETE(req: NextRequest) {
  return handleApi(req, req.nextUrl.pathname)
}
export function PATCH(req: NextRequest) {
  return handleApi(req, req.nextUrl.pathname)
}
