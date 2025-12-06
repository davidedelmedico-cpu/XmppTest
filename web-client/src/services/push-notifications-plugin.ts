/**
 * Plugin Stanza.js per XEP-0357: Push Notifications
 * 
 * Questo plugin registra i namespace e gli elementi necessari per XEP-0357
 * nel sistema JXT (JSON-XML Translation) di Stanza.js
 */

import type { Agent } from 'stanza'
import type { Registry, DefinitionOptions } from 'stanza/jxt'
import type { AgentConfig } from 'stanza'
import { attribute } from 'stanza/jxt'

const PUSH_NAMESPACE = 'urn:xmpp:push:0'

/**
 * Definizioni per XEP-0357
 */
const Protocol: DefinitionOptions[] = [
  // Elemento <enable> per abilitare push notifications
  {
    element: 'enable',
    fields: {
      jid: attribute('jid'),
      node: attribute('node'),
    },
    namespace: PUSH_NAMESPACE,
    path: 'iq.enablePush',
  },
  // Elemento <disable> per disabilitare push notifications
  {
    element: 'disable',
    fields: {
      jid: attribute('jid'),
      node: attribute('node'),
    },
    namespace: PUSH_NAMESPACE,
    path: 'iq.disablePush',
  },
]

/**
 * Plugin per abilitare il supporto XEP-0357 in Stanza.js
 */
export default function (_client: Agent, registry: Registry, _config: AgentConfig): void {
  // Registra le definizioni nel registry
  registry.define(Protocol)
}
