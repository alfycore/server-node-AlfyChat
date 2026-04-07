import { Socket } from 'socket.io-client';

export function registerSetupHandlers(socket: Socket) {
  socket.on('SETUP_CODE', ({ code, expiresIn }: { code: string; serverId: string; expiresIn: number }) => {
    const border = '═'.repeat(54);
    const minutes = Math.floor(expiresIn / 60);
    console.log('\n╔' + border + '╗');
    console.log('║    ⚠️  CODE ADMIN — RÉCLAMEZ VOS DROITS            ║');
    console.log('╠' + border + '╣');
    console.log(`║  Code    : ${code.padEnd(44)}║`);
    console.log(`║  Expire  : dans ${String(minutes).padEnd(36)} min ║`);
    console.log('╠' + border + '╣');
    console.log('║  → Paramètres du serveur > Server Node             ║');
    console.log('║    → "Réclamer les droits admin"                   ║');
    console.log('╚' + border + '╝\n');
  });
}
