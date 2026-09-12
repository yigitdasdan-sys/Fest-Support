const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Rol ID Sabitleri
const OTO_ROL_ID = '1547915323649556570';
const DESTEK_YETKILI_ROL_ID = '1547917093058641961';

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
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        // Yeni Eklenen Sil Komutu
        new SlashCommandBuilder()
            .setName('sil')
            .setDescription('Belirtilen miktarda mesajı siler.')
            .addIntegerOption(option =>
                option.setName('sayi')
                .setDescription('Silinecek mesaj sayısı (1-100 arası)')
                .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
});

client.on('guildMemberAdd', async member => {
    try {
        const role = member.guild.roles.cache.get(OTO_ROL_ID);
        if (role) {
            await member.roles.add(role);
        }
    } catch (error) {
        console.error('Oto rol verilirken hata oluştu:', error);
    }
});

client.on('interactionCreate', async interaction => {
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

        if (interaction.commandName === 'sil') {
            const miktar = interaction.options.getInteger('sayi');

            if (miktar < 1 || miktar > 100) {
                return interaction.reply({ content: 'Lütfen 1 ile 100 arasında bir sayı girin!', ephemeral: true });
            }

            try {
                await interaction.channel.bulkDelete(miktar, true);
                await interaction.reply({ content: `Başarıyla **${miktar}** adet mesaj silindi!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Mesajlar silinirken bir hata oluştu (14 günden eski mesajlar toplu silinemez).', ephemeral: true });
            }
        }

        if (interaction.commandName === 'ticket-kurulum') {
            const logoUrl = 'https://cdn.discordapp.com/attachments/1548383428930441258/1548445525823455292/ChatGPT_Image_12_Eyl_2026_23_18_28.png?ex=6aa715c6&is=6aa5c446&hm=319f2ec7b3fa3edf745657800bed2eda3e56fd1e33948684834849c83de74758&';

            const embed = new EmbedBuilder()
                .setTitle('🎟️ Fest - Destek & İşlem Merkezi')
                .setDescription('Aşağıdaki menüden yapmak istediğiniz işlemi seçerek destek talebi (ticket) oluşturabilirsiniz.')
                .setColor('Purple')
                .setImage(logoUrl);

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

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_menu') {
            const selectedValue = interaction.values[0];
            let ticketType = 'destek';

            if (selectedValue === 'ticket_satin_alim') { ticketType = 'satin-alim'; }
            else if (selectedValue === 'ticket_partner') { ticketType = 'partner'; }

            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const channelName = `${ticketType}-${interaction.user.username}`;

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
                    {
                        id: DESTEK_YETKILI_ROL_ID,
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

            const hosgeldinMetni = `${hosgeldinMesajiYaz(selectedValue, interaction.user)}\nYetkili Ekip: <@&${DESTEK_YETKILI_ROL_ID}>`;

            await ticketChannel.send({ content: hosgeldinMetni, components: [closeButton] });
            await interaction.editReply({ content: `Ticket kanalınız açıldı: ${ticketChannel}` });
        }
    }

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
    if (type === 'ticket_satin_label' || type === 'ticket_satin_alim') return `Merhaba ${user}, satın alım talebiniz alındı. Yetkililerimiz birazdan ilgilenecektir.`;
    if (type === 'ticket_partner') return `Merhaba ${user}, partnerlik şartları için yetkiliyi bekleyin.`;
    return `Merhaba ${user}, destek ekibimiz en kısa sürede sizinle ilgilenecektir.`;
}

client.login(process.env.TOKEN);
