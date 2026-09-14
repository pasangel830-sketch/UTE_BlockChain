# Notas para la memoria (desviaciones respecto al PDF)

Copiar a la memoria del TFM. No dejarlas solo en el plan interno.

## 1. API en VM propia, no Railway ni Render

El PDF de la propuesta cita Railway o Render. Se usa una VM GCP (`fabric-ute`) en la misma red Docker que los peers.

Motivo: Render Free suspende el proceso; el listener del evento `PagoAutorizado` dejaría de correr y un pago en escrow no se notificaría al mock bancario. Render Starter es de pago. Railway tiene el mismo riesgo de sleep en plan free. La rúbrica exige el flujo de pago observable en la defensa.

Coste: crédito GCP 300 USD; la VM se apaga fuera de ensayos.

## 2. Chaincode en TypeScript

La rúbrica pide 4 chaincodes en TypeScript con tests unitarios. Implementación: TypeScript compilado a JavaScript, runtime Node 18 (`fabric-nodeenv:2.5`). No se entrega JavaScript fuente como contrato.

## 3. EstadoObra sin llamadas cruzadas entre chaincodes

El PDF describe un estado de obra consolidado. Fabric 2.5 permite invoke entre contratos, pero es frágil (timeouts, identidad, PDC, invoke anidado con el mismo txid). EstadoObraContract guarda el agregado; el backend lo calcula a partir de Hito/Pago/Incidencia y hace un `submit` único. **No** hay `invokeChaincode` hacia EstadoObra.

## 4. cryptogen en lugar de Fabric CA

Alineado con el alcance local y el plazo de 14 días. Identidades de prueba, no PKI de producción. Anotar como simplificación explícita.

## 5. LevelDB en lugar de CouchDB

Listados con composite keys y `GetStateByRangeWithPagination`. Sin rich queries. Menos RAM en el portátil de 16 GB.

## 6. Roles en la API, no en el chaincode

La separación constructora / Administración (avanzar obra, autorizar o rechazar pagos, tramitar solo la incidencia propia, adjuntar evidencias) se aplica en Express (`perfilConstructora`, `requireAdministracion`, `requireCreadoraIncidencia`, `requireAdjuntoIncidencia`, `requireSocioEvidencia`). El chaincode de pago sigue exigiendo endoso org+Admin. Anotar: la UI y el JWT son la demostración de quién pulsa; un cliente que ignore la API no es el camino de defensa.

## 7. Hito → Pago sí usa invoke cruzado (11 sep)

`completarHito` llama a `PagoContract:ponerEnCustodia` en la misma transacción para que no quede hito COMPLETADO sin custodia. `ponerEnCustodia` recibe `origen=completarHito` y **no** consulta el hito: Fabric rechaza un segundo invoke anidado con el mismo txid. Si se llama a custodia por otro camino, sí exige hito COMPLETADO. Código en `develop`. Jest 11/11. Si la red diaria sigue con el chaincode anterior: `make deploy-cc`. La captura de ese redeploy no está en el informe técnico.

## 8. Evidencias fuera de cadena; hash en ledger o PDC

El multer del día 6 subía un archivo suelto. El 11 sep hay dos anclajes: (1) acta al **completar hito** — disco + SHA-256 en `hashEvidencia` del hito (`POST /hitos/:id/completar` o adjunto previo en VALIDACION); (2) parte de **incidencia** — disco + SHA-256 en `notasTecnicas` del PDC. El binario no entra en Fabric. Incidencias: mismas reglas de socio de lote que el PDC. Hitos: solo la empresa del hito adjunta en VALIDACION. Día 12: `STORAGE_DRIVER=gcs` en `fabric-ute` (bucket `ute-tfm-evidencias-$PROJECT_ID`, SA por defecto de la VM, sin JSON de clave en el repo).

## 9. Seed demo (día 12)

`network/scripts/seed-data.sh` reproduce el guion de [MANUAL.md](MANUAL.md) §6 vía `POST /auth/login`. En producción del día 12: `SEED_EMPTY=1` — ledger de hitos/pagos/incidencias a cero; el tribunal lo crea a mano. `make seed` local sigue el guion completo.

## 10. Caddy el día 12 (desviación del checklist «sin Caddy»)

Sin TLS de Let's Encrypt en un FQDN, Vercel Hobby no puede llamar a la API en el navegador (mixed content o certificado no confiable). Caddy 2.11.4 en `fabric-ute` hace reverse_proxy de `ute-tfm.duckdns.org` → API y de `/grafana` → Grafana en `monitoring-ute` (`10.8.0.3:3000`). Let's Encrypt del FQDN de la API vale también para el iframe.
