<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
<<<<<<< HEAD
        // User::factory(10)->create();

        User::factory()->create([
=======
        // User::factory(10)->withPersonalTeam()->create();

        User::factory()->withPersonalTeam()->create([
>>>>>>> authentication
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
