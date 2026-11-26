import React from 'react';
import { Link, useLocation } from "react-router-dom";

// Shown for any path that doesn't match a page
function NotFound() {
    const { pathname } = useLocation();
    return (
        <div className="loader-container">
            <div className="error-box">
                <h1 className="h4">Page not found</h1>
                <p>There is no page at <code>{pathname}</code>.</p>
                <Link to="/" className="btn btn-outline-danger btn-sm">Go to the home page</Link>
            </div>
        </div>
    );
}

export default NotFound;
