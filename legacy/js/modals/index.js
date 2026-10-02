// Registre des modales, ouvertes via data-action="openModal" data-modal="<nom>".
import { EmailModal } from './EmailModal.js';
import { ClientModal } from './ClientModal.js';

const modals = {
    email: EmailModal,
    client: ClientModal,
};

export function ModalHost({ modal }) {
    if (!modal) return '';
    const Component = modals[modal.name];
    return Component ? Component(modal.params ?? {}) : '';
}
