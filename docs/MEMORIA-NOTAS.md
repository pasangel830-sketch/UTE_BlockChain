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

`completarHito` llama a `PagoContract:ponerEnCustodia` en la misma transacción para que no quede hito COMPLETADO sin custodia. `ponerEnCustodia` recibe `origen=completarHito` y **no** consulta el hito: Fabric rechaza un segundo invoke anidado con el mismo txid. Si se llama a custodia por otro camino, sí exige hito COMPLETADO. Jest 11/11. Redeploy en la red diaria (`make deploy-cc`) pendiente de captura.

## 8. Evidencias fuera de cadena; hash en PDC

El multer del día 6 subía un archivo suelto. El 11 sep el adjunto se ancla a la incidencia: disco local + SHA-256; el hash va a `notasTecnicas` del detalle privado. El binario no entra en Fabric (RAM y tamaño de bloque). Las mismas reglas de socio de lote que el PDC. GCS queda para el día 12.
