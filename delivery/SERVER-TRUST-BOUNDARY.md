# Revisão do contrato de cálculo de portes — alteração proposta

O helper atual `artessencia_quote_zone_fee_draft(text,jsonb)` recebe um JSON arbitrário. **Não deve ser disponibilizado como RPC pública**, pois as tarifas seriam controláveis por quem o invoca.

## Contrato mais seguro para implementação futura

A função de encomendas existente deve obter `artessencia_shop_settings.data.delivery` usando o identificador de proprietário determinado internamente, nunca fornecido pelo cliente. A validação do código postal e a determinação da tarifa devem ser executadas no contexto desse pedido, sem uma nova RPC pública que receba configurações ou tarifas.

É preferível incorporar o cálculo na mesma transação da criação da encomenda, garantindo a coerência da configuração consultada com os dados guardados. Caso seja indispensável um helper privado, colocá-lo num esquema não exposto, com privilégios mínimos e entrada restrita a código postal e proprietário validado internamente. A função de encomendas deve usar um papel com autorizações estritamente auditadas. Não acrescentar uma RPC pública nova para este cálculo.

## Critérios bloqueantes antes de disponibilizar

1. Verificar em PostgreSQL as permissões `EXECUTE`, titularidade, SECURITY DEFINER e RLS.
2. Confirmar que um utilizador anónimo não consegue forçar zona, tarifa ou subtotal.
3. Confirmar que o servidor calcula os produtos, portes, descontos e total de forma consistente.
4. Verificar bloqueio de concorrência na edição das zonas e na gravação de encomendas.
5. Executar cenários de rollback, encomendas repetidas, promoções e capacidades.
6. Testar com dados fictícios num PostgreSQL isolado antes de qualquer deploy.

**Não aplicar nem instalar as propostas SQL atuais.** A função antiga com argumento JSON é um artefacto de estudo e não foi aprovada para migração.
