# Corpus WhatsApp — Ingesta 2026-08-28

## Propósito

Transformar una exportación de WhatsApp de uso interno en un corpus trazable y
sanitizado para comprender la operación observada y contrastarla con el
aplicativo actual. El resultado no importa datos al backend ni modifica reglas
de negocio.

## Navegación

1. [Ficha del corpus y custodia](01_ficha_corpus_y_custodia.md)
2. [Metodología y criterios](02_metodologia_y_criterios.md)
3. [Inventario y cobertura](03_inventario_y_cobertura.md)
4. [Catálogo de referencias](04_catalogo_de_referencias.md)
5. [Actores, canales y roles](05_actores_canales_y_roles.md)
6. [Operaciones reconstruidas](06_operaciones_reconstruidas.md)
7. [Procesos AS-IS](07_procesos_as_is.md)
8. [Reglas, excepciones y controles observados](08_reglas_excepciones_y_controles_observados.md)
9. [Catálogo de datos y glosario](09_catalogo_de_datos_y_glosario.md)
10. [Calidad, incertidumbres y preguntas](10_calidad_incertidumbres_y_preguntas.md)
11. [Matriz de trazabilidad](11_matriz_de_trazabilidad.md)
12. [Comparación con el sistema actual](12_comparacion_con_el_sistema_actual.md)
13. [Hallazgos, recomendaciones y backlog](13_hallazgos_recomendaciones_y_backlog.md)
14. [Síntesis de comprensión del negocio basada exclusivamente en evidencia real](14_sintesis_comprension_negocio_evidencia_real.md)
15. [Marco de uso de evidencia para evaluar el aplicativo](15_marco_uso_evidencia_para_evaluar_aplicativo.md)
16. [Banco de escenarios históricos sanitizados](16_banco_escenarios_historicos_sanitizados.md)
17. [Matriz de cobertura y adaptación del aplicativo](17_matriz_cobertura_adaptacion_aplicativo.md)
18. [Plan de pruebas de adaptación](18_plan_pruebas_adaptacion_aplicativo.md)

## Lectura rápida

El chat funciona como una bitácora operativa retrospectiva. Predominan
declaraciones de viajes, combustible, fondos operativos, rendiciones de gasto,
pagos de personal, mantenimiento, cobranza/facturación y conservación de
documentos. El aplicativo ya modela gran parte del ciclo viaje–dinero–flota,
pero su adaptación es parcial: la diferencia principal está en el actor y el
momento de captura, la consulta de evidencias y el tratamiento de excepciones
como gastos tardíos y continuaciones.

El hallazgo técnico más urgente es que el contrato actual permite a personal
insertar un gasto nuevo después del cierre de una rendición; debe exigirse una
reapertura autoritativa. También se debe separar rendición de planilla y evitar
la custodia futura de credenciales en chat. La credencial histórica identificada
fue rotada según el propietario y no se reproduce en esta documentación.
