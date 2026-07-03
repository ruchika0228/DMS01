import React, { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const GlobalAlert = ({
    message,
    type = 'info', // success, error, warning, info
    onClose,
    duration = 4000
}) => {
    // When a message is present, the alert is open
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (message) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [message]);

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
        if (onClose) {
            // Delay calling onClose to allow the exit animation to play
            setTimeout(() => {
                onClose();
            }, 300);
        }
    };

    // Icons mapping
    const iconMapping = {
        success: <CheckCircleIcon fontSize="inherit" />,
        error: <ErrorOutlineIcon fontSize="inherit" />,
        warning: <WarningAmberIcon fontSize="inherit" />,
        info: <InfoOutlinedIcon fontSize="inherit" />,
    };

    return (
        <Snackbar
            open={open}
            autoHideDuration={duration}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ width: '100%', maxWidth: '600px', mt: 4 }}
        >
            <Alert
                onClose={handleClose}
                severity={type}
                variant="outlined"
                iconMapping={iconMapping}
                sx={{
                    width: '100%',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    backdropFilter: 'blur(10px)',
                    backgroundColor: 'rgba(30, 30, 30, 0.8)', // Dark semi-transparent background
                    color: '#fff',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', // Glassmorphism shadow
                    border: (theme) => {
                        // Dynamic border color based on severity
                        const colors = {
                            success: theme.palette.success.main,
                            error: theme.palette.error.main,
                            warning: theme.palette.warning.main,
                            info: theme.palette.info.main,
                        };
                        return `1px solid ${colors[type] || theme.palette.info.main}`;
                    },
                    '& .MuiAlert-icon': {
                        color: (theme) => {
                            const colors = {
                                success: theme.palette.success.main,
                                error: theme.palette.error.main,
                                warning: theme.palette.warning.main,
                                info: theme.palette.info.main,
                            };
                            return colors[type] || theme.palette.info.main;
                        },
                    },
                    '& .MuiAlert-message': {
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
};

export default GlobalAlert;
