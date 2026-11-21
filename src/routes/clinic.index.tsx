import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/clinic/')({
  beforeLoad: () => { throw redirect({ to: '/clinic/settings' }) },
})
