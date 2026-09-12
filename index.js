const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Slash Komutlarını Kaydetme ve Tanımlama
client.once('ready', async () => {
    console.log(`Bot aktif: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Belirtilen kullanıcıyı sunucudan banlar.')
            .addUserOption(option => 
                option.setName('kullanici')
                .setDescription('Banlanacak kullanıcı')
                .setRequired(true))
            .addStringOption(option => 
                option.setName('sebep')
                .setDescription('Ban sebebi')
                .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

        new SlashCommandBuilder()
            .setName('ticket-kurulum')
            .setDescription('Destek bilet sistemini mesaj olarak gönderir.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Slash komutları yükleniyor...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
});

// Komutlar ve Ticket Etkileşimleri
client.on('interactionCreate', async interaction => {
    // 1. Slash Komut Yönetimi
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ban') {
            const user = interaction.options.getUser('kullanici');
            const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
            const member = interaction.guild.members.cache.get(user.id);

            if (!member) {
                return interaction.reply({ content: 'Bu kullanıcı sunucuda bulunmuyor!', ephemeral: true });
            }

            try {
                await member.ban({ reason: reason });
                await interaction.reply({ content: `${user.tag} başarıyla banlandı! Sebep: ${reason}`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Bu kullanıcıyı banlamaya yetkim yetmiyor!', ephemeral: true });
            }
        }

        if (interaction.commandName === 'ticket-kurulum') {
            const embed = new EmbedBuilder()
                .setTitle('🎟️ Destek & İşlem Merkezi')
                .setDescription('Aşağıdaki menüden yapmak istediğiniz işlemi seçerek destek talebi (ticket) oluşturabilirsiniz.')
                .setColor('Blue');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_menu')
                    .setPlaceholder('Bir işlem seçin...')
                    .addOptions([
                        { label: 'Destek', description: 'Genel destek talebi oluştur.', value: 'ticket_destek', emoji: '🛠️' },
                        { label: 'Satın Alım', description: 'Ürün veya hizmet satın alımı için.', value: 'ticket_satin_alim', emoji: '🛒' },
                        { label: 'Partnerlik', description: 'Sunucu partnerlik işlemleri için.', value: 'ticket_partner', emoji: '🤝' },
                    ]),
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: 'Ticket paneli başarıyla kuruldu!', ephemeral: true });
        }
    }

    // 2. Ticket Menü Seçimi ve Kanal Oluşturma
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_menu') {
            const selectedValue = interaction.values[0];
            let ticketType = 'destek';

            if (selectedValue === 'ticket_satin_alim') { ticketType = 'satin-alim'; }
            else if (selectedValue === 'ticket_partner') { ticketType = 'partner'; }

            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const channelName = `${ticketType}-${interaction.user.username}`;

            // Ticket kanalı oluşturma
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
            });

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Kanalı Kapat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await ticketChannel.send({ content: hosgeldinMesajiYaz(selectedValue, interaction.user), components: [closeButton] });
            await interaction.editReply({ content: `Ticket kanalınız açıldı: ${ticketChannel}` });
        }
    }

    // 3. Ticket Kapatma Butonu
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('Bu kanal 5 saniye içinde siliniyor...');
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }
});

function hosgeldinMesajiYaz(type, user) {
    if (type === 'ticket_satin_alim') return `Merhaba ${user}, satın alım talebiniz alındı. Yetkililer birazdan ilgilenecektir.`;
    if (type === 'ticket_partner') return `Merhaba ${user}, partnerlik şartları için yetkiliyi bekleyin.`;
    return `Merhaba ${user}, destek ekibimiz en kısa sürede sizinle ilgilenecektir.`;
}

client.login(process.env.TOKEN);
