<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('planes', function (Blueprint $table) {
            $table->boolean('es_gratis')->default(false)->after('color_badge');
        });
    }

    public function down()
    {
        Schema::table('planes', function (Blueprint $table) {
            $table->dropColumn('es_gratis');
        });
    }
};