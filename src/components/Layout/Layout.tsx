import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
    return (
        <div className="flex min-h-screen bg-zinc-950">
            <Sidebar />
            <div className="flex-1 ml-60 flex flex-col">
                <TopBar />
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
