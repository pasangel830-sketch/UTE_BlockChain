# Notas para la memoria (desviaciones respecto al PDF)

Copiar a la memoria del TFM. No dejarlas solo en el plan interno.

## 1. API en VM propia, no Railway ni Render

El PDF de la propuesta cita Railway o Render. Se usa una VM GCP (`fabric-ute`) en la misma red Docker que los peers.

Motivo: Render Free suspende el proceso; el listener del evento `PagoAutorizado` dejaría de correr y un pago en escrow no se notificaría al mock bancario. Render Starter es de pago. Railway tiene el mismo riesgo de sleep en plan free. La rúbrica exige el flujo de pago observable en la defensa.

Coste: crédito GCP 300 USD; la VM se apaga fuera de ensayos.

## 2. Chaincode en TypeScript

La rúbrica pide 4 chaincodes en TypeScript con tests unitarios. Implementación: TypeScript compilado a JavaScript, runtime Node 18 (`fabric-nodeenv:2.5`). No se entrega JavaScript fuente como contrato.

## 3. EstadoObra sin llamadas cruzadas entre chaincodes

El PDF describe un estado de obra consolidado. Fabric 2.5 permite invoke entre contratos, pero es frágil en el camino crítico (timeouts, identidad, PDC). EstadoObraContract guarda el agregado; el backend lo calcula a partir de Hito/Pago/Incidencia y hace un `submit` único. Los cuatro contratos TypeScript existen; no hay `ctx.stub.invokeChaincode` en el path de demo.

## 4. cryptogen en lugar de Fabric CA

Alineado con el alcance local y el plazo de 14 días. Identidades de prueba, no PKI de producción. Anotar como simplificación explícita.

## 5. LevelDB en lugar de CouchDB

Listados con composite keys y `GetStateByRangeWithPagination`. Sin rich queries. Menos RAM en el portátil de 16 GB.
