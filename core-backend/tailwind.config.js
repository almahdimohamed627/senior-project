import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';
<<<<<<< HEAD
=======
import typography from '@tailwindcss/typography';
>>>>>>> authentication

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
<<<<<<< HEAD
=======
        './vendor/laravel/jetstream/**/*.blade.php',
>>>>>>> authentication
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },

<<<<<<< HEAD
    plugins: [forms],
=======
    plugins: [forms, typography],
>>>>>>> authentication
};
