import { changePassword } from '@/app/auth-actions';
import { Card, PageHeader } from '@/components/ui';
import { PasswordForm } from '@/features/account/PasswordForm';
import { getCurrentUser } from '@/lib/current-user';

export const metadata = { title: 'Mon compte' };

export default async function AccountPage() {
    const user = await getCurrentUser();
    return (
        <>
            <PageHeader title="Mon compte" subtitle={`${user.name} · ${user.email} · ${user.organizationName}`} />
            <Card title="Changer de mot de passe">
                <PasswordForm action={changePassword} submitLabel="Changer le mot de passe">
                    <label>
                        Mot de passe actuel
                        <input name="currentPassword" type="password" className="input" autoComplete="current-password" required />
                    </label>
                    <div className="form-row">
                        <label>
                            Nouveau mot de passe (8 caractères minimum)
                            <input name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
                        </label>
                        <label>
                            Confirmation
                            <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={8} />
                        </label>
                    </div>
                </PasswordForm>
            </Card>
        </>
    );
}
