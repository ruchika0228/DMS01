import React from 'react';
import './ImageViewer.css';

const ImageViewer = ({ file, url }) => {
    const [imageUrl, setImageUrl] = React.useState(null);

    React.useEffect(() => {
        if (url) {
            setImageUrl(url);
        } else if (file && file instanceof Blob) {
            const objectUrl = URL.createObjectURL(file);
            setImageUrl(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
    }, [file, url]);

    return (
        <div className="image-viewer">
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt={file?.name || 'Preview'}
                    className="preview-image"
                />
            )}
        </div>
    );
};

export default ImageViewer;
