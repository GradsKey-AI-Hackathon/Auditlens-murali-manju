const state = {
    mode: "login",
    role: "buyer"
};


/* ============================================================
   ELEMENTS
   ============================================================ */

const tabs =
    document.querySelectorAll(".tab");

const roles =
    document.querySelectorAll(".role");

const form =
    document.getElementById("authForm");

const submitBtn =
    document.getElementById("submitBtn");

const message =
    document.getElementById("message");

const subtitle =
    document.getElementById("subtitle");

const switchText =
    document.getElementById("switchText");

const switchLink =
    document.getElementById("switchLink");

const buyerFields =
    document.getElementById("buyerFields");

const vendorFields =
    document.getElementById("vendorFields");

const loginNote =
    document.getElementById("loginNote");


/* ============================================================
   MESSAGE
   ============================================================ */

function showMessage(text, type) {

    message.textContent = text;

    message.className =
        "message " + type;
}


function clearMessage() {

    message.textContent = "";

    message.className = "message";
}


/* ============================================================
   ERROR HANDLER
   ============================================================ */

function getErrorMessage(data, status) {

    if (!data) {
        return `Request failed (${status})`;
    }

    if (typeof data.detail === "string") {
        return data.detail;
    }

    if (Array.isArray(data.detail)) {

        return data.detail
            .map(error => {

                const location =
                    error.loc || [];

                const field =
                    location.length
                        ? location[location.length - 1]
                        : "field";

                return `${field}: ${error.msg}`;

            })
            .join(", ");
    }

    return (
        data.message ||
        data.error ||
        `Request failed (${status})`
    );
}


/* ============================================================
   RENDER
   ============================================================ */

function render() {

    tabs.forEach(tab => {

        tab.classList.toggle(
            "active",
            tab.dataset.tab === state.mode
        );

    });


    roles.forEach(role => {

        role.classList.toggle(
            "active",
            role.dataset.role === state.role
        );

    });


    document
        .querySelectorAll(".signup-only")
        .forEach(element => {

            element.classList.add("hidden");

        });


    if (state.mode === "signup") {

        if (state.role === "buyer") {

            buyerFields.classList.remove(
                "hidden"
            );

        }

        if (state.role === "vendor") {

            vendorFields.classList.remove(
                "hidden"
            );

        }

    }


    loginNote.classList.toggle(
        "hidden",
        state.mode !== "login"
    );


    if (state.mode === "login") {

        subtitle.textContent =
            "Welcome back — log in to continue";

        submitBtn.textContent =
            "Log In";

        switchText.textContent =
            "Don't have an account?";

        switchLink.textContent =
            "Sign up";

    } else {

        subtitle.textContent =
            "Create your account to get started";

        submitBtn.textContent =
            `Sign Up as ${
                state.role === "buyer"
                    ? "Buyer"
                    : "Vendor"
            }`;

        switchText.textContent =
            "Already have an account?";

        switchLink.textContent =
            "Log in";

    }
}


/* ============================================================
   TAB CLICK
   ============================================================ */

tabs.forEach(tab => {

    tab.addEventListener(
        "click",
        () => {

            state.mode =
                tab.dataset.tab;

            clearMessage();

            render();

        }
    );

});


/* ============================================================
   ROLE CLICK
   ============================================================ */

roles.forEach(role => {

    role.addEventListener(
        "click",
        () => {

            state.role =
                role.dataset.role;

            clearMessage();

            render();

        }
    );

});


/* ============================================================
   LOGIN <-> SIGNUP
   ============================================================ */

switchLink.addEventListener(
    "click",
    () => {

        state.mode =
            state.mode === "login"
                ? "signup"
                : "login";

        clearMessage();

        render();

    }
);


/* ============================================================
   URL ROLE
   ============================================================ */

const urlRole =
    new URLSearchParams(
        window.location.search
    ).get("role");

if (
    urlRole === "buyer" ||
    urlRole === "vendor"
) {

    state.role = urlRole;
}


/* ============================================================
   FORM SUBMIT
   ============================================================ */

form.addEventListener(
    "submit",
    async event => {

        /*
         * IMPORTANT:
         * Prevent normal browser form submission.
         * Otherwise browser can perform GET /auth/login,
         * which causes 405.
         */
        event.preventDefault();

        clearMessage();


        const data =
            Object.fromEntries(
                new FormData(form).entries()
            );


        /* ----------------------------------------------------
           VALIDATION
           ---------------------------------------------------- */

        if (!data.email?.trim()) {

            showMessage(
                "Email is required.",
                "error"
            );

            return;
        }


        if (!data.password) {

            showMessage(
                "Password is required.",
                "error"
            );

            return;
        }


        if (data.password.length < 6) {

            showMessage(
                "Password must be at least 6 characters.",
                "error"
            );

            return;
        }


        if (state.mode === "signup") {

            if (
                state.role === "buyer" &&
                !data.name?.trim()
            ) {

                showMessage(
                    "Please enter your full name.",
                    "error"
                );

                return;
            }


            if (
                state.role === "vendor" &&
                !data.business_name?.trim()
            ) {

                showMessage(
                    "Please enter the business name.",
                    "error"
                );

                return;
            }


            if (
                state.role === "vendor" &&
                !data.owner_name?.trim()
            ) {

                showMessage(
                    "Please enter the owner name.",
                    "error"
                );

                return;
            }


            if (
                state.role === "vendor" &&
                !data.phone?.trim()
            ) {

                showMessage(
                    "Phone number is required for vendors.",
                    "error"
                );

                return;
            }

        }


        /* ----------------------------------------------------
           ENDPOINT
           ---------------------------------------------------- */

        let endpoint;

        if (state.mode === "login") {

            endpoint =
                "/auth/login";

        } else if (state.role === "buyer") {

            endpoint =
                "/auth/signup/buyer";

        } else {

            endpoint =
                "/auth/signup/vendor";
        }


        /* ----------------------------------------------------
           PAYLOAD
           ---------------------------------------------------- */

        let payload;


        if (state.mode === "login") {

            payload = {

                email:
                    data.email.trim(),

                password:
                    data.password,

                role:
                    state.role.toUpperCase()
            };

        }


        else if (state.role === "buyer") {

            payload = {

                name:
                    data.name.trim(),

                email:
                    data.email.trim(),

                phone:
                    data.phone?.trim() || null,

                password:
                    data.password
            };

        }


        else {

            payload = {

                business_name:
                    data.business_name.trim(),

                owner_name:
                    data.owner_name.trim(),

                email:
                    data.email.trim(),

                phone:
                    data.phone.trim(),

                address:
                    data.address?.trim() || null,

                password:
                    data.password
            };
        }


        /* ----------------------------------------------------
           BUTTON
           ---------------------------------------------------- */

        submitBtn.disabled = true;

        submitBtn.textContent =
            state.mode === "login"
                ? "Logging in..."
                : "Creating account...";


        /* ----------------------------------------------------
           REQUEST
           ---------------------------------------------------- */

        try {

            /*
             * IMPORTANT:
             *
             * Do NOT change config.js.
             *
             * This page explicitly prefixes /api so:
             *
             * /auth/login
             *       ↓
             * /api/auth/login
             *
             * Nginx then forwards it to FastAPI:
             *
             * /auth/login
             */

            const response =
                await fetch(
                    "/api" + endpoint,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload)
                    }
                );


            let result = {};

            try {

                result =
                    await response.json();

            } catch {

                result = {};

            }


            /* ------------------------------------------------
               ERROR
               ------------------------------------------------ */

            if (!response.ok) {

                throw new Error(
                    getErrorMessage(
                        result,
                        response.status
                    )
                );
            }


            /* =================================================
               LOGIN SUCCESS
               ================================================= */

            if (state.mode === "login") {

                const userId =
                    result.user_id;

                const role =
                    String(
                        result.role ||
                        state.role
                    ).toUpperCase();


                if (!userId) {

                    throw new Error(
                        "Login succeeded but no user ID was returned."
                    );
                }


                /*
                 * Save simple demo session.
                 *
                 * This matches config.js.
                 */

                setSession(
                    userId,
                    role
                );


                showMessage(
                    "Login successful! Redirecting...",
                    "success"
                );


                /*
                 * Redirect based on role.
                 */

                setTimeout(
                    () => {

                        if (role === "VENDOR") {

                            window.location.href =
                                "/vendor.html";

                        } else {

                            window.location.href =
                                "/buyer.html";

                        }

                    },
                    700
                );

            }


            /* =================================================
               SIGNUP SUCCESS
               ================================================= */

            else {

                showMessage(
                    "Account created successfully! Please log in.",
                    "success"
                );


                form.reset();


                setTimeout(
                    () => {

                        state.mode =
                            "login";

                        render();

                        showMessage(
                            "Account created successfully! Please log in.",
                            "success"
                        );

                    },
                    1200
                );
            }

        }


        catch (error) {

            console.error(
                "Authentication error:",
                error
            );

            showMessage(
                error.message ||
                "Something went wrong. Please try again.",
                "error"
            );

        }


        finally {

            submitBtn.disabled =
                false;

            render();
        }

    }
);


/* ============================================================
   INITIALIZE
   ============================================================ */

render();
