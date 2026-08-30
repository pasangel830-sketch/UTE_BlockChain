import { config } from './config';
import { getGateway } from './fabric';

export async function startPagoListener(): Promise<void> {
  const loop = async (): Promise<void> => {
    for (;;) {
      try {
        const network = (await getGateway('EmpresaAMSP')).getNetwork(config.channelName);
        const events = await network.getChaincodeEvents(config.chaincodePago);
        try {
          for await (const event of events) {
            if (event.eventName !== 'PagoAutorizado') {
              continue;
            }
            const payload = JSON.parse(Buffer.from(event.payload).toString('utf8'));
            console.log('evento PagoAutorizado', payload);
            const res = await fetch(config.mockBancoUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });
            console.log('webhook mock banco', res.status);
          }
        } finally {
          events.close();
        }
      } catch (err) {
        console.error('listener PagoAutorizado', err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };
  void loop();
}
