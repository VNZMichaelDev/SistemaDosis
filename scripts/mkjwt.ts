import { SignJWT } from 'jose'
async function main() {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_change_me')
  for (const pair of [['admin','1'],['mesero','2'],['encargado','3']] as const) {
    const rol = pair[0], sub = pair[1]
    const tok = await new SignJWT({ usuario: rol, rol }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime('1h').sign(secret)
    console.log(rol + '=' + tok)
  }
}
main()
