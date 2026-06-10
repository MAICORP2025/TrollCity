import { Link } from 'react-router-dom'

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#09050f] text-white">
            <div className="glass-card rounded-3xl border border-blue-500/20 bg-slate-950/80 p-10 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <h1 className="text-5xl font-semibold">404</h1>
                <p className="mt-4 text-lg text-slate-300">Page not found.</p>
                <Link to="/" className="mt-6 inline-flex glow-button">Return home</Link>
            </div>
        </div>
    )
}
