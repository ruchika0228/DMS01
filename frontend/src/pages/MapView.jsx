import UserMap from '../components/Map/UserMap';
import { useTheme } from '../context/ThemeContext';
import { mapUsers, fileTransfers } from '../data/mapData';
import './MapView.css';

const MapView = () => {
    const { isDark } = useTheme();
    const activeCount = mapUsers.filter(u => u.status === 'Active').length;
    const transferCount = fileTransfers.length;

    return (
        <div className="mapview-page fade-in">
            {/* Page Header */}
            <div className="mapview-header">
                <div className="mapview-header-left">
                    <div>
                        <h1 className="page-title mapview-title">Map View</h1>
                        <p className="page-subtitle">Live geographic visualization of file transfers</p>
                    </div>
                </div>

            </div>

            {/* Map */}
            <div className="mapview-container">
                <UserMap isDark={isDark} />
            </div>
        </div>
    );
};

export default MapView;
